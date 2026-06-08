# campus-stray-animal-system

笃行猫谱 - 校园流浪动物系统

基于开源项目"中大猫谱（笃行猫谱）"，仅作为学习记录，未用于任何商业用途。

---

## 文档导航

- [📖 项目结构说明](./docs/项目结构说明.md) - 详细的目录结构和功能说明
- [📝 版本更新历史](./docs/版本更新历史.md) - 完整的版本迭代记录

---

## 快速开始

### 技术栈
- 前端：微信小程序原生框架 + WeUI
- 后端：EMAS Serverless（阿里云）
- 数据库：EMAS 云数据库
- 存储：EMAS 内置云存储

### 当前版本
v0.0.7 (体验版)

---

## v0.0.7 (体验版) 修改报告

### 恢复头像上传逻辑至原项目版本
**文件**：
- `miniprogram/components/modifyUserInfo/modifyUserInfo.js`
- `miniprogram/utils/common.js`
- `miniprogram/utils/user.js`
- `functionsEMAS/unionOp/userOp.js`
- `miniprogram/pages/info/userInfo/userInfo.js`  
**内容**：
- 移除所有多余的 URL 清理逻辑
- 移除图片压缩功能
- 恢复简洁的 `uploadAvatar` 和 `uploadFile` 函数
- 移除云函数中的 URL 清理逻辑
- 与原项目 `zhongdamaopu-1.18.5-2` 的上传逻辑保持一致

---

## v0.0.6 (体验版) 修改报告

### 完善前端上传逻辑
**文件**：`miniprogram/components/modifyUserInfo/modifyUserInfo.js`  
**内容**：
- 修复昵称输入事件兼容性
- 添加头像上传路径格式处理
- 新增临时路径回显和防缓存时间戳

### 优化用户信息获取
**文件**：`miniprogram/utils/user.js`  
**内容**：
- 在 `getUser`、`getUserInfo`、`getUserInfoMulti` 方法中添加头像 URL 清理逻辑
- 使用 `trim().replace(/[`"]/g, '')` 清理多余字符

### 添加图片压缩
**文件**：`miniprogram/components/modifyUserInfo/modifyUserInfo.js`  
**内容**：
- 添加文件大小检查（超过 1MB 自动压缩）
- 使用 `wx.compressImage` 进行图片压缩，质量设为 80
- 压缩后重新获取文件信息并上传

### 修复头像显示缓存问题
**文件**：
- `miniprogram/components/modifyUserInfo/modifyUserInfo.js`
- `miniprogram/pages/info/userInfo/userInfo.js`  
**内容**：
- 在头像 URL 后添加时间戳 `?t=${Date.now()}` 防止缓存
- 临时路径回显时直接使用临时文件路径

### 修复 app.json 配置
**文件**：`miniprogram/app.json`  
**内容**：
- 移除错误的 `requiredPrivateInfos` 字段（该字段不支持 `chooseAvatar`）
- 保留正确的权限声明

### 修复 /saaa_config.json 路径错误
**文件**：`miniprogram/utils/common.js`  
**内容**：
- 移除对腾讯云 COS SDK 的导入
- 简化 `ensureCos` 和 `signCosUrl` 函数
- 删除不再需要的辅助函数

---

## 历史版本

### v0.0.5 (体验版)
**问题**：昵称可以修改，但头像无法上传  
**修改文件**：
1. `miniprogram/config.js` - 禁用私有腾讯云 COS
2. `miniprogram/utils/common.js` - 完善 EMAS 存储处理

**修复内容**：
- 将 `use_private_tencent_cos` 设为 `false`，使用 EMAS 内置云存储
- 统一 EMAS 上传返回值格式为 `{fileId, fileUrl}`
- 添加详细调试日志

### v0.0.4 (体验版)
**问题**：小程序用户设置昵称和头像失败  
**修改文件**：
1. `functionsEMAS/unionOp/userOp.js` - 修复云函数逻辑
2. `miniprogram/components/modifyUserInfo/modifyUserInfo.js` - 完善前端处理
3. `miniprogram/components/modifyUserInfo/modifyUserInfo.wxml` - 优化昵称输入

**修复内容**：
- 云函数：添加用户存在性检查、修复 `_id` 获取方式
- 前端：兼容昵称和头像选择的事件格式、完善上传逻辑、添加错误处理

### v0.0.3 (体验版)
更新了新的 EMAS 数据

### v0.0.2 (体验版)
项目初步部署

### v0.0.1 (开发版)
项目初步部署

---

## 更多文档

完整的版本历史和项目结构说明请查看：
- [版本更新历史](./docs/版本更新历史.md)
- [项目结构说明](./docs/项目结构说明.md)
