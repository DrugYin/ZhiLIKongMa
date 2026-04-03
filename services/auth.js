/**
 * 认证服务
 */

const { userApi } = require('./api');
const { setStorageSync, getStorageSync, removeStorage } = require('./storage');
const { CACHE_KEYS } = require('../utils/constant');

/**
 * 认证服务类
 */
class AuthService {
  /**
   * 获取当前用户 openid
   */
  static getOpenid() {
    return getStorageSync(CACHE_KEYS.OPENID) || '';
  }

  /**
   * 检查用户是否已登录
   */
  static isLoggedIn() {
    const userInfo = this.getLocalUserInfo();
    return userInfo !== null && userInfo.is_registered === true;
  }

  /**
   * 获取本地用户信息
   */
  static getLocalUserInfo() {
    const raw = getStorageSync(CACHE_KEYS.USER_INFO);
    if (!raw) return null;

    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        if (parsed.expire && Date.now() > parsed.expire) {
          return null;
        }
        return parsed.data || null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * 查询用户信息
   */
  static async getUserInfo() {
    const userRes = await userApi.getUserInfo();

    const isRegistered = userRes?.is_registered || false;
    const userInfo = userRes?.data || null;
    
    // 将 is_registered 合并到用户信息中，确保存储的用户信息包含此字段
    if (userInfo) {
      userInfo.is_registered = isRegistered;
    }
    return userInfo
  }

  /**
   * 获取当前角色
   */
  static getCurrentRole() {
    const userInfo = this.getLocalUserInfo();
    return userInfo?.current_role || 'student';
  }

  /**
   * 检查用户是否拥有指定角色
   */
  static hasRole(role) {
    const userInfo = this.getLocalUserInfo();
    return userInfo?.roles?.includes(role) || false;
  }

  /**
   * 微信登录
   */
  static async wxLogin() {
    // 1. 获取 openid
    const loginRes = await userApi.login();
    if (!loginRes.success) {
      throw new Error(loginRes.message || '登录失败');
    }
    const openid = loginRes.data.openid;
    setStorageSync(CACHE_KEYS.OPENID, openid);

    // 2. 查询用户信息
    const userInfo = await this.getUserInfo();

    const isRegistered = userInfo?.is_registered || false;
    
    // 将 is_registered 合并到用户信息中，确保存储的用户信息包含此字段

    return {
      openid,
      is_registered: isRegistered,
      user_info: userInfo
    };
  }

  /**
   * 用户注册
   */
  static async register(params) {
    const res = await userApi.register(params);

    if (!res.success) {
      throw new Error(res.message || '注册失败');
    }

    const userInfo = res.data;
    setStorageSync(CACHE_KEYS.USER_INFO, JSON.stringify(userInfo));
    return userInfo;
  }

  /**
   * 切换角色
   */
  static async switchRole(role) {
    const res = await userApi.switchRole(role);

    if (res.success) {
      // 更新本地缓存
      let userInfo = await this.getUserInfo();
      if (userInfo) {
        userInfo.current_role = role;
        setStorageSync(CACHE_KEYS.USER_INFO, JSON.stringify(userInfo));
      }
      return true;
    }

    throw new Error(res.message || '切换失败');
  }

  /**
   * 更新本地用户信息
   */
  static updateLocalUserInfo(userInfo) {
    setStorageSync(CACHE_KEYS.USER_INFO, JSON.stringify(userInfo));
  }

  /**
   * 更新用户信息
   */

  static async updateUserInfo(userInfo) {
    const res = await userApi.updateUser(userInfo);
    if (!res.success) {
      throw new Error(res.message || '更新失败');
    }
    this.getUserInfo().then(updatedInfo => {
      this.updateLocalUserInfo(updatedInfo);
    });
    return res;
  }

  /**
   * 退出登录
   */
  static async logout() {
    await Promise.all([
      removeStorage(CACHE_KEYS.USER_INFO),
      removeStorage(CACHE_KEYS.OPENID)
    ]);
  }

  /**
   * 跳转到登录页
   */
  static navigateToLogin(redirectUrl) {
    const url = redirectUrl
      ? `/pages/login/index?redirect=${encodeURIComponent(redirectUrl)}`
      : '/pages/login/index';
    wx.navigateTo({ url });
  }
}

module.exports = AuthService;
