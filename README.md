campus-stray-animal-system
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
