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
    onChooseAvatar(e) {
      // 兼容不同的返回格式
      let avatarUrl = e.detail && e.detail.avatarUrl !== undefined ? e.detail.avatarUrl : e.detail;
      console.log('onChooseAvatar', e, avatarUrl);
      if (avatarUrl) {
        this.setData({
          "user.userInfo.avatarUrl": avatarUrl,
        });
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
        user: user
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
        var fileInfo = await this.uploadAvatar(user.userInfo.avatarUrl);
        user.userInfo.avatarUrl = fileInfo.fileUrl;
        user.userInfo.avatarUrlId = fileInfo.fileId;
      }

      console.log('准备更新的用户信息:', user);

      try {
        // 更新数据库的userInfo
        const updateResult = await api.userOp({
          op: 'update',
          user: user
        });
        console.log('更新结果:', updateResult);

        wx.hideLoading();

        // 发布更新事件
        removeCacheItem("current-user");
        app.globalData.eventBus.$emit('userInfoUpdated');

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
      if (!tempFilePath || !tempFilePath.includes("://tmp")) {
        // 如果不是临时文件路径，直接返回现有信息
        return { 
          fileId: this.data.user.userInfo.avatarUrlId || '', 
          fileUrl: tempFilePath || this.data.user.userInfo.avatarUrl 
        };
      }

      //获取后缀，如果没有后缀则默认为jpg
      const index = tempFilePath.lastIndexOf(".");
      const ext = index > 0 ? tempFilePath.substr(index + 1) : 'jpg';
      // 上传图片
      let upRes = await uploadFile({
        filePath: tempFilePath, // 小程序临时文件路径
        cloudPath: `/user/avatar/${openid}.${ext}`, // 上传至云端的路径
      })

      console.log('upRes', upRes);

      // 兼容不同的返回格式
      let fileId = upRes.fileId || upRes.fileID || '';
      let fileUrl = upRes.fileUrl || upRes.url || tempFilePath;
      
      // 关键修复：清理 URL 中的反引号、空格和其他多余字符
      if (fileUrl) {
        fileUrl = fileUrl.trim().replace(/[`"]/g, '');
      }
      if (fileId) {
        fileId = fileId.trim().replace(/[`"]/g, '');
      }
      
      return { fileId: fileId, fileUrl: fileUrl };
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