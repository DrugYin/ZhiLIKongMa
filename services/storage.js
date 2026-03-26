/**
 * 本地存储服务封装
 */

const { CACHE_KEYS, CACHE_DURATION } = require('../utils/constant');

/**
 * 设置缓存
 * @param key 缓存键
 * @param data 缓存数据
 * @param duration 缓存时长（毫秒）
 */
function setCache(key, data, duration) {
  duration = duration !== undefined ? duration : CACHE_DURATION.MEDIUM;
  try {
    const item = {
      data,
      expire: Date.now() + duration
    };
    wx.setStorageSync(key, JSON.stringify(item));
  } catch (error) {
    console.error('[Cache Set Error]', key, error);
  }
}

/**
 * 获取缓存
 * @param key 缓存键
 * @param defaultValue 默认值
 * @returns 缓存数据或默认值
 */
function getCache(key, defaultValue) {
  if (defaultValue === undefined) {
    defaultValue = null;
  }
  try {
    const str = wx.getStorageSync(key);
    if (!str) {
      return defaultValue;
    }

    const item = JSON.parse(str);
    
    // 检查是否过期
    if (item.expire && Date.now() > item.expire) {
      removeCache(key);
      return defaultValue;
    }

    return item.data;
  } catch (error) {
    console.error('[Cache Get Error]', key, error);
    return defaultValue;
  }
}

/**
 * 删除缓存
 * @param key 缓存键
 */
function removeCache(key) {
  try {
    wx.removeStorageSync(key);
  } catch (error) {
    console.error('[Cache Remove Error]', key, error);
  }
}

/**
 * 清除所有缓存
 */
function clearCache() {
  try {
    wx.clearStorageSync();
  } catch (error) {
    console.error('[Cache Clear Error]', error);
  }
}

/**
 * 获取缓存信息
 * @returns 当前缓存使用情况
 */
function getCacheInfo() {
  return new Promise((resolve, reject) => {
    wx.getStorageInfo({
      success: resolve,
      fail: reject
    });
  });
}

// ========== 用户信息相关 ==========

/**
 * 设置用户信息
 */
function setUserInfo(userInfo) {
  setCache(CACHE_KEYS.USER_INFO, userInfo, CACHE_DURATION.VERY_LONG);
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  return getCache(CACHE_KEYS.USER_INFO);
}

/**
 * 清除用户信息
 */
function clearUserInfo() {
  removeCache(CACHE_KEYS.USER_INFO);
  removeCache(CACHE_KEYS.OPENID);
}

// ========== OpenID 相关 ==========

/**
 * 设置 OpenID
 */
function setOpenid(openid) {
  setCache(CACHE_KEYS.OPENID, openid, CACHE_DURATION.VERY_LONG);
}

/**
 * 获取 OpenID
 */
function getOpenid() {
  return getCache(CACHE_KEYS.OPENID);
}

// ========== 系统配置相关 ==========

/**
 * 设置系统配置
 */
function setConfig(config) {
  setCache(CACHE_KEYS.CONFIG, config, CACHE_DURATION.LONG);
}

/**
 * 获取系统配置
 */
function getConfig() {
  return getCache(CACHE_KEYS.CONFIG);
}

// ========== 项目列表相关 ==========

/**
 * 设置项目列表
 */
function setProjects(projects) {
  setCache(CACHE_KEYS.PROJECTS, projects, CACHE_DURATION.LONG);
}

/**
 * 获取项目列表
 */
function getProjects() {
  return getCache(CACHE_KEYS.PROJECTS);
}

// ========== 封装原生存储 API ==========

/**
 * 同步设置存储
 */
function setStorageSync(key, data) {
  wx.setStorageSync(key, data);
}

/**
 * 同步获取存储
 */
function getStorageSync(key) {
  return wx.getStorageSync(key);
}

/**
 * 异步设置存储
 */
function setStorage(key, data) {
  return new Promise((resolve, reject) => {
    wx.setStorage({
      key,
      data,
      success: () => resolve(),
      fail: reject
    });
  });
}

/**
 * 异步获取存储
 */
function getStorage(key) {
  return new Promise((resolve, reject) => {
    wx.getStorage({
      key,
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}

/**
 * 异步删除存储
 */
function removeStorage(key) {
  return new Promise((resolve, reject) => {
    wx.removeStorage({
      key,
      success: () => resolve(),
      fail: reject
    });
  });
}

module.exports = {
  setCache,
  getCache,
  removeCache,
  clearCache,
  getCacheInfo,
  setUserInfo,
  getUserInfo,
  clearUserInfo,
  setOpenid,
  getOpenid,
  setConfig,
  getConfig,
  setProjects,
  getProjects,
  setStorageSync,
  getStorageSync,
  setStorage,
  getStorage,
  removeStorage
};
