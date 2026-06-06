import { getUser } from "../../utils/user";
import { deepcopy, compressImage } from "../../utils/utils";
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
    onChooseAvatar(e) {
      console.log('=== onChooseAvatar 完整信息 ===');
      console.log('事件对象:', e);
      
      // 兼容不同的返回格式
      let avatarUrl = e.detail && e.detail.avatarUrl !== undefined ? e.detail.avatarUrl : e.detail;
      
      console.log('选择的头像 URL:', avatarUrl);
      
      if (avatarUrl) {
        this.setData({
          tempAvatarUrl: avatarUrl,
          "user.userInfo.avatarUrl": avatarUrl,
          avatarTimestamp: Date.now() // 更新时间戳防缓存
        });
      }
      console.log('=== onChooseAvatar 结束 ===');
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
        var fileInfo = await this.uploadAvatar(user.userInfo.avatarUrl);
        user.userInfo.avatarUrl = fileInfo.fileUrl;
        user.userInfo.avatarUrlId = fileInfo.fileId;
      }
      
      // 关键修复：在保存到数据库前再次清理 avatarUrl
      if (user.userInfo && user.userInfo.avatarUrl) {
        user.userInfo.avatarUrl = user.userInfo.avatarUrl.trim().replace(/[`"]/g, '');
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

        // 上传成功后更新临时路径和时间戳，确保用户看到新头像
        this.setData({
          tempAvatarUrl: user.userInfo.avatarUrl || '',
          avatarTimestamp: Date.now()
        });

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
      console.log('=== uploadAvatar 开始 ===');
      console.log('传入的 tempFilePath:', tempFilePath);
      
      const openid = this.data.user.openid;
      let filePathToUpload = tempFilePath;
      
      // 首先获取文件信息
      let fileSize = 0;
      try {
        const fileInfo = await wx.getFileInfo({
          filePath: tempFilePath
        });
        console.log('文件信息:', fileInfo);
        fileSize = fileInfo.size;
        console.log('文件大小:', fileSize, 'bytes');
        console.log('文件大小(MB):', (fileSize / 1024 / 1024).toFixed(2));
      } catch (err) {
        console.warn('获取文件信息失败:', err);
      }
      
      if (!tempFilePath || !tempFilePath.includes("://tmp")) {
        console.log('不是临时文件路径，直接返回现有信息');
        // 如果不是临时文件路径，直接返回现有信息
        return { 
          fileId: this.data.user.userInfo.avatarUrlId || '', 
          fileUrl: tempFilePath || this.data.user.userInfo.avatarUrl 
        };
      }

      //获取后缀，如果没有后缀则默认为jpg
      const index = tempFilePath.lastIndexOf(".");
      let ext = index > 0 ? tempFilePath.substr(index + 1) : 'jpg';
      ext = ext.toLowerCase();
      console.log('文件扩展名:', ext);
      
      // 检查文件类型是否合法
      const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      if (!allowedExts.includes(ext)) {
        console.warn('不支持的文件类型:', ext, '使用默认 jpg');
        ext = 'jpg';
      }
      
      // 如果图片大于 1MB，先压缩（和其他页面保持一致）
      const MAX_SIZE = 1024 * 1024; // 1MB
      if (fileSize > MAX_SIZE) {
        console.log('文件大小超过 1MB，开始压缩...');
        try {
          filePathToUpload = await compressImage(tempFilePath, 80); // 80% 质量
          console.log('压缩完成，新路径:', filePathToUpload);
          
          // 重新获取压缩后的文件大小
          try {
            const compressedInfo = await wx.getFileInfo({
              filePath: filePathToUpload
            });
            console.log('压缩后文件大小:', compressedInfo.size, 'bytes');
            console.log('压缩后文件大小(MB):', (compressedInfo.size / 1024 / 1024).toFixed(2));
          } catch (err) {
            console.warn('获取压缩后文件信息失败:', err);
          }
        } catch (compressErr) {
          console.warn('压缩失败，使用原文件上传:', compressErr);
          filePathToUpload = tempFilePath;
        }
      }
      
      console.log('上传路径:', `/user/avatar/${openid}.${ext}`);
      console.log('实际上传的文件路径:', filePathToUpload);
      
      // 上传图片
      let upRes;
      try {
        upRes = await uploadFile({
          filePath: filePathToUpload, // 小程序临时文件路径
          cloudPath: `/user/avatar/${openid}.${ext}`, // 上传至云端的路径
        });
        console.log('上传结果 upRes:', upRes);
      } catch (uploadError) {
        console.error('=== 上传失败 ===');
        console.error('错误信息:', uploadError);
        console.error('错误详情:', JSON.stringify(uploadError, null, 2));
        wx.showToast({
          title: '头像上传失败',
          icon: 'error',
          duration: 2000
        });
        throw uploadError;
      }

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
      
      console.log('处理后的 fileId:', fileId);
      console.log('处理后的 fileUrl:', fileUrl);
      console.log('=== uploadAvatar 结束 ===');
      
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