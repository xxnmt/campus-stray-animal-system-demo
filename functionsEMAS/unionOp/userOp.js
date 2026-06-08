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
      // 使用 Unicode 正则表达式匹配各种引号和空白字符
      if (user.userInfo && user.userInfo.avatarUrl) {
        user.userInfo.avatarUrl = user.userInfo.avatarUrl
          .trim()
          .replace(/[\u0060\u2018\u2019\u201C\u201D\u2032\u2033\u0027\u0022]/g, '')  // 匹配各种引号字符
          .replace(/[\s\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]/g, ''); // 移除所有空白字符
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
