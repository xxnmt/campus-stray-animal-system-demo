// 负责用户表的管理、使用接口
import { randomInt } from './utils';
import { getGlobalSettings } from "./page";
import { getCacheItem, setCacheItem } from "./cache";
import { signCosUrl } from "./common";
import config from "../config";
import api from "./cloudApi";

const app = getApp();

const UserTypes = {
  manager: "manager",
  invited: "invited",
  guest: "guest"
}

const FuncTypes = {
  uploadPhoto: "uploadPhoto",
  comment: "comment",
  reward: "reward",
  feedback: "feedback",
  fullTab: "fullTab",
}

// 获取当前用户
// 如果数据库中没有会后台自动新建并返回
async function getUser(options) {
  options = options || {};
  const key = "current-user";
  let userRes = await getCacheItem(key, options);
  if (userRes) {
    console.log(`cached ${key}`);
    return userRes;
  }

  // 直接调用云函数，不再通过 api 对象
  const openid = await api.getCurrentUserOpenid();
  userRes = (await api.userOp({
    op: 'get',
    openid: openid
  }));
  if (userRes && userRes.userInfo) {
    // 关键修复：清理 URL 中的反引号、空格和其他多余字符
    // 使用 Unicode 正则表达式匹配各种引号和空白字符
    if (userRes.userInfo.avatarUrl) {
      userRes.userInfo.avatarUrl = userRes.userInfo.avatarUrl
        .trim()
        .replace(/[\u0060\u2018\u2019\u201C\u201D\u2032\u2033\u0027\u0022]/g, '')  // 匹配各种引号字符
        .replace(/[\s\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]/g, ''); // 移除所有空白字符
    }
    userRes.userInfo.avatarUrl = await signCosUrl(userRes.userInfo.avatarUrl);
  }

  setCacheItem(key, userRes, 0, randomInt(25, 35))
  return userRes;
}

// 使用openid来读取用户信息
async function getUserInfo(openid, options) {
  const key = `uinfo-${openid}`;
  var value = getCacheItem(key, options);
  if (value != undefined) {
    return value;
  }

  // 重新获取
  const { result } = await app.mpServerless.db.collection('user').findOne({ openid: openid });
  if (!result) {
    console.log("user " + openid + " not existed.");
    return null;
  }
  
  // 关键修复：清理 URL 中的反引号、空格和其他多余字符
  if (result.userInfo && result.userInfo.avatarUrl) {
    result.userInfo.avatarUrl = result.userInfo.avatarUrl.trim().replace(/[`"]/g, '');
  }

  // 写入缓存（25-35min过期）
  setCacheItem(key, result, 0, randomInt(25, 35));

  return result;
}


// 使用openid来读取用户信息
async function getUserInfoMulti(openids, cacheOptions, retMap) {
  if (!openids) {
    return undefined;
  }
  var res = {};
  var not_found = [];
  
  // 如果启用了 nocache，所有用户都从数据库获取
  if (cacheOptions?.nocache) {
    not_found = [...openids];
  } else {
    // 正常模式：先从缓存获取
    for (var openid of openids) {
      if (res[openid]) {
        continue;
      }
      const cacheKey = `uinfo-${openid}`;
      var cacheItem = getCacheItem(cacheKey, cacheOptions);
      if (cacheItem) {
        res[openid] = cacheItem;
        continue;
      }
      not_found.push(openid);
    }
  }

  // 请求没有的（或 nocache 模式下所有用户）
  if (not_found.length) {
    var { result: db_res } = await app.mpServerless.db.collection('user').find({ openid: { $in: not_found } });
    for (var user of db_res) {
      // 关键修复：清理 URL 中的反引号、空格和其他多余字符
      // 使用 Unicode 正则表达式匹配各种引号和空白字符
      if (user.userInfo && user.userInfo.avatarUrl) {
        user.userInfo.avatarUrl = user.userInfo.avatarUrl
          .trim()
          .replace(/[\u0060\u2018\u2019\u201C\u201D\u2032\u2033\u0027\u0022]/g, '')  // 匹配各种引号字符
          .replace(/[\s\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]/g, ''); // 移除所有空白字符
      }
      const cacheKey = `uinfo-${user.openid}`;
      setCacheItem(cacheKey, user, 0, randomInt(25, 35));
      res[user.openid] = user;
    }
  }

  if (retMap) {
    return res;
  }
  return openids.map(x => res[x]);
}

async function _checkFuncEnable(funcName) {
  // 对特定人群、特地版本进行控制
  let accessCtrl = await getGlobalSettings("accessCtrl");
  let { ctrlUser, ctrlVersion, disabledFunc, limitedFunc } = accessCtrl;

  // 完全禁用，不需要判断人群/版本
  if (disabledFunc.split(",").includes(funcName)) {
    return false;
  }

  const { app_version } = config;
  if (ctrlVersion != "*" && ctrlVersion != app_version) {
    // 版本不匹配，限制不生效
    return true;
  }
  const user = await getUser();
  const isManager = await isManagerAsync();
  const isInvited = user.role == 1;
  ctrlUser = ctrlUser.split(",");
  if ((isManager && ctrlUser.includes(UserTypes.manager))      // 管理员
    || (isInvited && ctrlUser.includes(UserTypes.invited))     // 特邀用户
    || (!isManager && !isInvited && ctrlUser.includes(UserTypes.guest))) {   // 游客
    // 满足人群限制，返回功能是否受限
    return !limitedFunc.split(',').includes(funcName);
  }
  return true;
}

// 能否上传照片
async function checkCanUpload() {
  return await _checkFuncEnable(FuncTypes.uploadPhoto);
}

// 能否评论
async function checkCanComment() {
  return await _checkFuncEnable(FuncTypes.comment);
}

// 能否打赏投喂
async function checkCanReward() {
  return await _checkFuncEnable(FuncTypes.reward);
}

// 能否反馈
async function checkCanFeedback() {
  return await _checkFuncEnable(FuncTypes.feedback);
}

// 是否展示完整底Tab
async function checkCanFullTabBar() {
  return await _checkFuncEnable(FuncTypes.fullTab);
}

// 是否展示弹出公告
async function checkCanShowNews() {
  const tabBarOrder = wx.getStorageSync("tabBarOrder");
  if (!tabBarOrder) {
    return false;
  }
  return tabBarOrder.includes("news");
}

// 设置页面上的userInfo
async function getPageUserInfo(page, nocache) {
  // 检查用户信息有没有拿到，如果有就更新this.data
  const userRes = await getUser({ nocache: nocache || false });
  if (!userRes.userInfo || !userRes.userInfo == {}) {
    console.log('无用户信息');
    return false;
  }
  page.setData({
    isAuth: true,
    user: userRes,
  });
  return true;
}

async function isManagerAsync(req) {
  const user = await getUser();
  if (!req) {
    req = 1;
  }
  return user.manager && user.manager >= req;
}

// TODO，应该做成一个模块
async function checkAuth(page, level) {
  if (await isManagerAsync(level)) {
    page.setData({
      auth: true
    });
    return true;
  }
  page.setData({
    tipText: `只有管理员Level-${level}能进入嗷`,
    tipBtn: true,
  });
  return false;
}

// 去设置用户信息页，上传照片时点更新个人信息改为了跳出组件
// 不过貌似有些地方不能用组件，不太确定跳出组件或者跳转到页面哪种比较好
function toSetUserInfo() {
  const url = "/pages/info/userInfo/userInfo";
  wx.navigateTo({
    url: url,
  })
}

// 设置用户等级
async function setUserRole(openid, role) {
  const currentOpenid = await api.getCurrentUserOpenid();
  return (await api.userOp({
    "op": "updateRole",
    "user": {
      openid: openid,
      role: role
    },
    openid: currentOpenid
  }));
}

// 填充userInfo
// items: array类型，期待加上userInfo的内容
// openidKey：openid的字段名
// userInfoKey：userInfo的字段名
async function fillUserInfo(items, openidKey, userInfoKey, cacheOptions) {
  var openids = [];
  for (var item of items) {
    // 如果启用了 nocache，或者用户信息不存在/为空对象，都需要重新获取
    const needRefresh = cacheOptions?.nocache || 
                        item[userInfoKey] == undefined || 
                        (typeof item[userInfoKey] === 'object' && Object.keys(item[userInfoKey]).length === 0);
    
    if (needRefresh) {
      // 清空现有数据，强制重新获取
      item[userInfoKey] = undefined;
      const openid = item[openidKey];
      if (openid) {
        openids.push(openid);
      }
    }
  }
  
  var res = await getUserInfoMulti(openids, cacheOptions, true);
  for (var item of items) {
    if (item[userInfoKey] != undefined) {
      continue;
    }
    const openid = item[openidKey];
    item[userInfoKey] = res[openid]?.userInfo;
    console.log(item[userInfoKey]);
    if (item[userInfoKey]?.avatarUrl) {
      item[userInfoKey].avatarUrl = await signCosUrl(item[userInfoKey].avatarUrl);
    }
  }
  return;
}

module.exports = {
  UserTypes,
  FuncTypes,
  getUser,
  getUserInfo,
  getUserInfoMulti,
  getPageUserInfo,
  checkCanUpload,
  checkCanComment,
  checkCanReward,
  checkCanFeedback,
  checkCanFullTabBar,
  checkCanShowNews,
  isManagerAsync,
  checkAuth,
  toSetUserInfo,
  setUserRole,
  fillUserInfo,
}
