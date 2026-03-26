/**
 * 本地存储服务封装
 */

import { CACHE_KEYS, CACHE_DURATION } from '../utils/constant';

interface CacheItem<T = any> {
  data: T;
  expire: number;
}

/**
 * 设置缓存
 * @param key 缓存键
 * @param data 缓存数据
 * @param duration 缓存时长（毫秒）
 */
export function setCache<T = any>(key: string, data: T, duration: number = CACHE_DURATION.MEDIUM): void {
  try {
    const item: CacheItem<T> = {
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
export function getCache<T = any>(key: string, defaultValue: T | null = null): T | null {
  try {
    const str = wx.getStorageSync(key);
    if (!str) {
      return defaultValue;
    }

    const item: CacheItem<T> = JSON.parse(str);
    
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
export function removeCache(key: string): void {
  try {
    wx.removeStorageSync(key);
  } catch (error) {
    console.error('[Cache Remove Error]', key, error);
  }
}

/**
 * 清除所有缓存
 */
export function clearCache(): void {
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
export function getCacheInfo(): Promise<any> {
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
export function setUserInfo(userInfo: any): void {
  setCache(CACHE_KEYS.USER_INFO, userInfo, CACHE_DURATION.VERY_LONG);
}

/**
 * 获取用户信息
 */
export function getUserInfo(): any {
  return getCache(CACHE_KEYS.USER_INFO);
}

/**
 * 清除用户信息
 */
export function clearUserInfo(): void {
  removeCache(CACHE_KEYS.USER_INFO);
  removeCache(CACHE_KEYS.OPENID);
}

// ========== OpenID 相关 ==========

/**
 * 设置 OpenID
 */
export function setOpenid(openid: string): void {
  setCache(CACHE_KEYS.OPENID, openid, CACHE_DURATION.VERY_LONG);
}

/**
 * 获取 OpenID
 */
export function getOpenid(): string | null {
  return getCache<string>(CACHE_KEYS.OPENID);
}

// ========== 系统配置相关 ==========

/**
 * 设置系统配置
 */
export function setConfig(config: any): void {
  setCache(CACHE_KEYS.CONFIG, config, CACHE_DURATION.LONG);
}

/**
 * 获取系统配置
 */
export function getConfig(): any {
  return getCache(CACHE_KEYS.CONFIG);
}

// ========== 项目列表相关 ==========

/**
 * 设置项目列表
 */
export function setProjects(projects: any[]): void {
  setCache(CACHE_KEYS.PROJECTS, projects, CACHE_DURATION.LONG);
}

/**
 * 获取项目列表
 */
export function getProjects(): any[] | null {
  return getCache<any[]>(CACHE_KEYS.PROJECTS);
}

// ========== 封装原生存储 API ==========

/**
 * 异步设置存储
 */
export function setStorageSync(key: string, data: any): void {
  wx.setStorageSync(key, data);
}

/**
 * 同步获取存储
 */
export function getStorageSync(key: string): any {
  return wx.getStorageSync(key);
}

/**
 * 异步设置存储
 */
export function setStorage(key: string, data: any): Promise<void> {
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
export function getStorage<T = any>(key: string): Promise<T> {
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
export function removeStorage(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.removeStorage({
      key,
      success: () => resolve(),
      fail: reject
    });
  });
}

export default {
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