import { defineStore } from 'pinia';
import { getCloudbaseEnvId } from '@/api/cloudbase';

export const useAppStore = defineStore('app', {
  state: () => ({
    title: import.meta.env.VITE_APP_TITLE || '智慧控码后台管理',
    envId: getCloudbaseEnvId(),
    collapsed: false
  }),

  actions: {
    toggleCollapsed() {
      this.collapsed = !this.collapsed;
    }
  }
});
