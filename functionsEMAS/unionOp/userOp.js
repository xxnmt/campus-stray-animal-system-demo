module.exports = async (ctx) => {
  const openid = ctx.args?.openid
  const op = ctx.args?.op
  switch (op) {
    case 'get': {
      // 获取用户，如果没有就新建一个
      const {
        result: user
      } = await ctx.mpserverless.db.collection('user').findOne({
        openid: openid
      });
      if (user) {
        return user;
      }
      const {
        result: count
      } = await ctx.mpserverless.db.collection('user').count({});
      let newUser = {
        'openid': openid
      };
      if (count === 0) {
        newUser['manager'] = 99;
      }
      await ctx.mpserverless.db.collection('user').insertOne(newUser);
      const {
        result
      } = await ctx.mpserverless.db.collection('user').findOne({
        openid: openid
      });
      return result;
    }
    case 'update': {
      const {
        result: targetUser
      } = await ctx.mpserverless.db.collection('user').findOne({
        openid: openid
      });
      if (!targetUser) {
        return "Err, user not found.";
      }
      var user = ctx.args.user;
      const _id = targetUser._id;
      delete user._id; // 因为数据库不能更新_id
      delete user.openid; // 这个键唯一
      delete user.manager; // 不能用这个函数更新
      
      // 关键修复：清理 avatarUrl 中的反引号、空格和其他多余字符
      // 使用正则表达式直接提取 URL 部分（从 http/https 开始到图片扩展名结束）
      if (user.userInfo && user.userInfo.avatarUrl) {
        const urlMatch = user.userInfo.avatarUrl.match(/https?:\/\/[^\s`'"“”‘’´`]+?\.(png|jpg|jpeg|gif|webp)/i);
        if (urlMatch) {
          user.userInfo.avatarUrl = urlMatch[0];
        } else {
          // 如果匹配失败，尝试清理所有非 URL 字符
          user.userInfo.avatarUrl = user.userInfo.avatarUrl.replace(/[^a-zA-Z0-9:/._-]/g, '').replace(/\/+/g, '/');
        }
      }
      
      await ctx.mpserverless.db.collection('user').updateOne({
        _id: _id
      }, {
        $set: user
      });
      const {
        result
      } = await ctx.mpserverless.db.collection('user').findOne({
        openid: openid
      });
      return result;
    }
    case 'updateRole': {
      var user = ctx.args.user;
      const {
        result
      } = await ctx.mpserverless.db.collection('user').updateOne({
        openid: openid
      }, {
        $set: user
      });
      return result;
    }
    default: {
      return "unknown op: " + op;
    }
  }
};
