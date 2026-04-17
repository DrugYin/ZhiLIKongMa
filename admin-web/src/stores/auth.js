import { defineStore } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import { checkAdminAuth } from '@/api/admin';
import { auth, getLoginState } from '@/api/cloudbase';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    initialized: false,
    loginState: null,
    adminUser: null,
    permissionKeys: [],
    loading: false
  }),

  getters: {
    isLoggedIn: (state) => Boolean(state.loginState),
    isAdmin: (state) => Boolean(state.adminUser && state.adminUser.status !== 'disabled'),
    adminName: (state) => state.adminUser?.user_name || state.adminUser?.nick_name || '管理员'
  },

  actions: {
    async bootstrap() {
      this.loading = true;
      try {
        this.loginState = await getLoginState();
        if (this.loginState) {
          const adminInfo = await checkAdminAuth();
          this.adminUser = adminInfo.user || adminInfo.admin || adminInfo;
          this.permissionKeys = adminInfo.permissions || [];
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
      this.adminUser = null;
      this.permissionKeys = [];
      MessagePlugin.success('已退出后台');
    }
  }
});
