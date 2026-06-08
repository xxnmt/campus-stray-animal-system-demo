import { getUser } from "../../utils/user";
import { deepcopy } from "../../utils/utils";
import api from "../../utils/cloudApi";
import { uploadFile } from "../../utils/common";
import { removeCacheItem } from '../../utils/cache';
const app = getApp();

Component({
  data: {
    defaultAvatarUrl: "/pages/public/images/info/default_avatar.png",
    user: null,
    tempAvatarUrl: '', // 临时头像路径，用于选择后立即回显
    avatarTimestamp: 0 // 防缓存时间戳
  },

  properties: {
    show: {
      type: Boolean,
      value: false,
      observer: function (newVal, oldVal) {
        if (newVal && !oldVal) {
          this.loadUser();
        }
      }
    }
  },

  lifetimes: {
  },

  methods: {
    async onChooseAvatar() {
      // 使用 wx.chooseMedia 替代 chooseAvatar，避免缓存问题
      try {
        const res = await wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed']
        });
        
        if (res.tempFiles && res.tempFiles.length > 0) {
          const avatarUrl = res.tempFiles[0].tempFilePath;
          console.log('选择的头像路径:', avatarUrl);
          
          this.setData({
            tempAvatarUrl: avatarUrl,
            "user.userInfo.avatarUrl": avatarUrl,
            avatarTimestamp: Date.now() // 更新时间戳防缓存
          });
        }
      } catch (err) {
        console.error('选择头像失败:', err);
        // 用户取消选择，不做处理
      }
    },

    onChangeNickName(e) {
      // 兼容 type="nickname" 的情况，可能通过 e.detail.value 或 e.detail 获取值
      let value = e.detail && e.detail.value !== undefined ? e.detail.value : e.detail;
      console.log('onChangeNickName', e, value);
      this.setData({
        "user.userInfo.nickName": value,
      });
    },

    async loadUser() {
      var user = await getUser({
        nocache: true,
      });
      user = deepcopy(user);
      if (!user.userInfo) {
        user.userInfo = {};
      }
      this.setData({
        user: user,
        tempAvatarUrl: '', // 清空临时路径
        avatarTimestamp: 0 // 重置时间戳
      });
    },

    async clickUpload() {
      wx.showLoading({
        title: '保存中...',
      });

      var user = this.data.user;
      const openid = user.openid;
      if (!openid) {
        wx.showToast({
          title: '获取openid失败',
          icon: "error"
        });
        wx.hideLoading();
        return false;
      }

      if (!await this.checkNickName(user.userInfo.nickName)) {
        wx.hideLoading();
        return false;
      }

      // 允许只更新昵称，不强制要求有头像（但如果有头像会更新）
      if (user.userInfo.avatarUrl) {
        try {
          var fileInfo = await this.uploadAvatar(user.userInfo.avatarUrl);
          console.log('上传成功，fileInfo:', fileInfo);
          
          if (fileInfo && fileInfo.fileUrl) {
            user.userInfo.avatarUrl = fileInfo.fileUrl;
            user.userInfo.avatarUrlId = fileInfo.fileId;
            console.log('头像URL已更新:', user.userInfo.avatarUrl);
          } else {
            console.error('上传结果无效，fileUrl为空');
            throw new Error('上传失败');
          }
        } catch (err) {
          console.error('头像上传失败:', err);
          wx.hideLoading();
          wx.showToast({
            title: '头像上传失败',
            icon: 'error'
          });
          return false;
        }
      }

      console.log('准备更新的用户信息:', user);
      console.log('avatarUrlId:', user.userInfo?.avatarUrlId);
      console.log('avatarUrl:', user.userInfo?.avatarUrl);

      try {
        // 更新数据库的userInfo
        const updateResult = await api.userOp({
          op: 'update',
          user: user
        });
        console.log('更新结果:', updateResult);

        wx.hideLoading();

        // 上传成功后更新临时路径和时间戳，确保用户看到新头像
        this.setData({
          tempAvatarUrl: user.userInfo.avatarUrl || '',
          avatarTimestamp: Date.now()
        });

        // 先清理缓存，确保其他页面不会从缓存中获取旧数据
        removeCacheItem("current-user");
        // 清理 uinfo-${openid} 缓存，确保其他页面能获取到新头像
        removeCacheItem(`uinfo-${openid}`);
        console.log('已清理缓存: current-user, uinfo-' + openid);

        // 延迟发布更新事件，确保缓存清理完成
        setTimeout(() => {
          console.log('发布 userInfoUpdated 事件');
          app.globalData.eventBus.$emit('userInfoUpdated');
        }, 100);

        this.hide();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });

        this.triggerEvent('userInfoUpdated', { user: user });
      } catch (error) {
        console.error('更新用户信息失败:', error);
        wx.hideLoading();
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'error'
        });
      }
    },

    async uploadAvatar(tempFilePath) {
      const openid = this.data.user.openid;
      console.log('uploadAvatar called with tempFilePath:', tempFilePath);
      
      if (!tempFilePath.includes("://tmp")) {
        console.log('不是临时路径，直接返回现有头像');
        return { fileId: this.data.user.userInfo.avatarUrlId, fileUrl: tempFilePath };
      }

      //获取后缀
      const index = tempFilePath.lastIndexOf(".");
      const ext = tempFilePath.substr(index + 1);
      const cloudPath = `/user/avatar/${openid}.${ext}`;
      console.log('准备上传，cloudPath:', cloudPath);
      
      // 上传图片
      let upRes;
      try {
        upRes = await uploadFile({
          filePath: tempFilePath, // 小程序临时文件路径
          cloudPath: cloudPath, // 上传至云端的路径
        });
        console.log('上传结果 upRes:', upRes);
      } catch (err) {
        console.error('上传失败:', err);
        throw err;
      }

      // 检查上传结果
      if (!upRes || !upRes.fileUrl) {
        console.error('上传结果无效，fileUrl为空:', upRes);
        throw new Error('上传失败，未获取到文件URL');
      }

      return { fileId: upRes.fileId || '', fileUrl: upRes.fileUrl };
    },

    async checkNickName(name) {
      if (!name) {
        wx.showToast({
          title: '请输入昵称',
          icon: 'error'
        });
        return false;
      }
      if (name.length > 30) {
        wx.showToast({
          title: '昵称太长啦...20字',
          icon: 'error'
        });
        return false;
      }
      const checkRes = await api.contentSafeCheck("empty", name);
      if (!checkRes) {
        return true;
      }
      wx.showModal(checkRes);
      return false;
    },

    // 隐藏
    hide() {
      this.setData({ show: false });
      this.triggerEvent('close');
    }
  }
})