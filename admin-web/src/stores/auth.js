import { defineStore } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import { checkAdminAuth } from '@/api/admin';
import { auth, getAuthUser, getLoginState, signInWithPassword } from '@/api/cloudbase';

function getErrorMessage(error, fallback = '操作失败') {
  return error?.message || error?.msg || error?.error_description || fallback;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    initialized: false,
    loginState: null,
    authUser: null,
    adminUser: null,
    permissionKeys: [],
    loading: false
  }),

  getters: {
    isLoggedIn: (state) => Boolean(state.loginState),
    isAdmin: (state) => Boolean(state.adminUser && state.adminUser.status !== 'disabled'),
    adminName: (state) => {
      const metadata = state.authUser?.user_metadata || {};
      return state.adminUser?.user_name
        || state.adminUser?.nick_name
        || state.adminUser?.nickname
        || metadata.nickName
        || metadata.username
        || state.authUser?.email
        || state.authUser?.phone
        || '管理员';
    }
  },

  actions: {
    async bootstrap() {
      this.loading = true;
      try {
        this.loginState = await getLoginState();
        if (this.loginState) {
          this.authUser = await getAuthUser();
          const adminInfo = await checkAdminAuth();
          this.adminUser = adminInfo.user || adminInfo.admin || adminInfo;
          this.permissionKeys = adminInfo.permissions || [];
        } else {
          this.authUser = null;
          this.adminUser = null;
          this.permissionKeys = [];
        }
      } catch (error) {
        this.adminUser = null;
        this.permissionKeys = [];
        if (error.message) {
          console.warn('[admin-auth] bootstrap failed:', error.message);
        }
      } finally {
        this.initialized = true;
        this.loading = false;
      }
    },

    async loginWithPassword({ account, password }) {
      this.loading = true;
      try {
        const loginData = await signInWithPassword(account, password);
        this.loginState = await getLoginState();
        this.authUser = loginData.user || await getAuthUser();

        const adminInfo = await checkAdminAuth();
        this.adminUser = adminInfo.user || adminInfo.admin || adminInfo;
        this.permissionKeys = adminInfo.permissions || [];
        this.initialized = true;

        return {
          success: true,
          adminUser: this.adminUser
        };
      } catch (error) {
        this.adminUser = null;
        this.permissionKeys = [];
        throw new Error(getErrorMessage(error, '登录失败，请检查账号、密码或管理员权限'));
      } finally {
        this.loading = false;
      }
    },

    async refreshAdmin() {
      const adminInfo = await checkAdminAuth();
      this.adminUser = adminInfo.user || adminInfo.admin || adminInfo;
      this.permissionKeys = adminInfo.permissions || [];
    },

    async logout() {
      if (typeof auth.signOut === 'function') {
        await auth.signOut();
      }
      this.loginState = null;
      this.authUser = null;
      this.adminUser = null;
      this.permissionKeys = [];
      this.initialized = true;
      MessagePlugin.success('已退出后台');
    }
  }
});
