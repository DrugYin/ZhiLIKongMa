/**
 * 认证服务
 */

import { userApi } from './api';
import { setStorageSync, getStorageSync, removeStorage } from './storage';
import { CACHE_KEYS } from '../utils/constant';

export interface UserInfo {
  _id: string;
  user_name: string;
  nick_name: string;
  avatar_url: string;
  phone: string;
  school: string;
  grade: string;
  roles: string[];
  current_role: 'student' | 'teacher';
  points?: number;
  total_points?: number;
  status: string;
  is_registered: boolean;
  teacher_subject?: string;
  teacher_project?: string;
  teacher_title?: string;
}

export interface LoginResult {
  openid: string;
  is_registered: boolean;
  user_info: UserInfo | null;
}

/**
 * 认证服务类
 */
export class AuthService {
  /**
   * 获取当前用户 openid
   */
  static getOpenid(): string {
    return getStorageSync(CACHE_KEYS.OPENID) || '';
  }

  /**
   * 检查用户是否已登录
   */
  static isLoggedIn(): boolean {
    const userInfo = this.getUserInfo();
    return userInfo !== null && userInfo.is_registered;
  }

  /**
   * 获取当前用户信息
   */
  static getUserInfo(): UserInfo | null {
    const userInfoStr = getStorageSync(CACHE_KEYS.USER_INFO);
    if (!userInfoStr) return null;
    try {
      return typeof userInfoStr === 'string' ? JSON.parse(userInfoStr) : userInfoStr;
    } catch {
      return null;
    }
  }

  /**
   * 获取当前角色
   */
  static getCurrentRole(): 'student' | 'teacher' {
    const userInfo = this.getUserInfo();
    return userInfo?.current_role || 'student';
  }

  /**
   * 检查用户是否拥有指定角色
   */
  static hasRole(role: 'student' | 'teacher'): boolean {
    const userInfo = this.getUserInfo();
    return userInfo?.roles?.includes(role) || false;
  }

  /**
   * 微信登录
   */
  static async wxLogin(): Promise<LoginResult> {
    // 1. 获取 openid
    const loginRes = await userApi.login();
    if (!loginRes.success) {
      throw new Error(loginRes.message || '登录失败');
    }

    const openid = loginRes.data.openid;
    setStorageSync(CACHE_KEYS.OPENID, openid);

    // 2. 查询用户信息
    const userRes = await userApi.getUserInfo();

    return {
      openid,
      is_registered: userRes.data?.is_registered || false,
      user_info: userRes.data || null
    };
  }

  /**
   * 用户注册
   */
  static async register(params: {
    user_name: string;
    phone: string;
    school?: string;
    grade?: string;
    avatar_url?: string;
    nick_name?: string;
  }): Promise<UserInfo> {
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
  static async switchRole(role: 'student' | 'teacher'): Promise<boolean> {
    const res = await userApi.switchRole(role);

    if (res.success) {
      // 更新本地缓存
      const userInfo = this.getUserInfo();
      if (userInfo) {
        userInfo.current_role = role;
        setStorageSync(CACHE_KEYS.USER_INFO, JSON.stringify(userInfo));
      }
      return true;
    }

    if (res.data?.need_apply) {
      // 需要申请教师权限
      return false;
    }

    throw new Error(res.message || '切换失败');
  }

  /**
   * 申请教师权限
   */
  static async applyTeacher(params: { subject: string; project: string }): Promise<boolean> {
    const res = await userApi.applyTeacher(params);

    if (res.success) {
      // 更新本地缓存
      const userInfo = this.getUserInfo();
      if (userInfo) {
        userInfo.roles = [...(userInfo.roles || []), 'teacher'];
        setStorageSync(CACHE_KEYS.USER_INFO, JSON.stringify(userInfo));
      }
      return true;
    }

    throw new Error(res.message || '申请失败');
  }

  /**
   * 更新用户信息
   */
  static updateLocalUserInfo(userInfo: UserInfo): void {
    setStorageSync(CACHE_KEYS.USER_INFO, JSON.stringify(userInfo));
  }

  /**
   * 退出登录
   */
  static logout(): void {
    removeStorage(CACHE_KEYS.USER_INFO);
    removeStorage(CACHE_KEYS.OPENID);
  }

  /**
   * 跳转到登录页
   */
  static navigateToLogin(redirectUrl?: string): void {
    const url = redirectUrl
      ? `/pages/login/index?redirect=${encodeURIComponent(redirectUrl)}`
      : '/pages/login/index';
    wx.navigateTo({ url });
  }
}