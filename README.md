campus-stray-animal-system
v0.0.6 (体验版)：
## 修改报告
### 完善前端上传逻辑
文件 ： miniprogram/components/modifyUserInfo/modifyUserInfo.js 内容 ：
- 修复昵称输入事件兼容性
- 添加头像上传路径格式处理
- 新增临时路径回显和防缓存时间戳
### 优化用户信息获取
文件 ： miniprogram/utils/user.js 内容 ：
- 在 getUser 、 getUserInfo 、 getUserInfoMulti 方法中添加头像 URL 清理逻辑
- 使用 trim().replace(/[ "]/g, '')` 清理多余字符
### 添加图片压缩
文件 ： miniprogram/components/modifyUserInfo/modifyUserInfo.js 内容 ：
- 添加文件大小检查（超过 1MB 自动压缩）
- 使用 wx.compressImage 进行图片压缩，质量设为 80
- 压缩后重新获取文件信息并上传
### 修复头像显示缓存问题
文件 ：
- miniprogram/components/modifyUserInfo/modifyUserInfo.js
- miniprogram/pages/info/userInfo/userInfo.js 内容 ：
- 在头像 URL 后添加时间戳 ?t=${Date.now()} 防止缓存
- 临时路径回显时直接使用临时文件路径
### 修复 app.json 配置
文件 ： miniprogram/app.json 内容 ：
- 移除错误的 requiredPrivateInfos 字段（该字段不支持 chooseAvatar ）
- 保留正确的权限声明

v0.0.5（体验版）：
问题 ：昵称可以修改，但头像无法上传
修改文件 ：
1. miniprogram/config.js - 禁用私有腾讯云COS
2. miniprogram/utils/common.js - 完善EMAS存储处理
修复内容 ：
- 将 use_private_tencent_cos 设为 false ，使用EMAS内置云存储
- 统一EMAS上传返回值格式为 {fileId, fileUrl}
- 添加详细调试日志

v0.0.4（体验版）：
问题 ：小程序用户设置昵称和头像失败
修改文件 ：
1. functionsEMAS/unionOp/userOp.js - 修复云函数逻辑
2. miniprogram/components/modifyUserInfo/modifyUserInfo.js - 完善前端处理
3. miniprogram/components/modifyUserInfo/modifyUserInfo.wxml - 优化昵称输入
修复内容 ：
- 云函数：添加用户存在性检查、修复 _id 获取方式
- 前端：兼容昵称和头像选择的事件格式、完善上传逻辑、添加错误处理

v0.0.3（体验版）：更新了新的EMAS数据
v0.0.2（体验版）：项目初步部署
v0.0.1（开发版）：项目初步部署
基于开源项目“中大猫谱（笃行猫谱）”，仅作为学习记录，未用于任何商业用途。
