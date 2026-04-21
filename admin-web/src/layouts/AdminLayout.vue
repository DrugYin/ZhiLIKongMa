<template>
  <t-layout class="admin-shell">
    <t-aside class="admin-aside" :width="appStore.collapsed ? '72px' : '232px'">
      <div class="brand">
        <div class="brand-mark">控</div>
        <div v-if="!appStore.collapsed" class="brand-copy">
          <strong>智慧控码</strong>
          <span>运营后台</span>
        </div>
      </div>

      <t-menu
        theme="light"
        :collapsed="appStore.collapsed"
        :value="activeMenu"
        @change="handleMenuChange"
      >
        <t-menu-item v-for="item in menus" :key="item.path" :value="item.path">
          {{ item.label }}
        </t-menu-item>
      </t-menu>
    </t-aside>

    <t-layout>
      <t-header class="admin-header">
        <t-button theme="default" variant="text" @click="appStore.toggleCollapsed">
          {{ appStore.collapsed ? '展开' : '收起' }}
        </t-button>
        <div class="header-meta">
          <t-tag theme="primary" variant="light">env: {{ appStore.envId }}</t-tag>
          <span>{{ authStore.adminName }}</span>
          <t-button size="small" variant="outline" @click="handleLogout">退出</t-button>
        </div>
      </t-header>

      <t-content class="admin-content">
        <router-view />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();

const menus = [
  { path: '/dashboard', label: '运营概览' },
  { path: '/config', label: '系统配置' },
  { path: '/projects', label: '项目配置' },
  { path: '/users', label: '用户管理' },
  { path: '/tasks', label: '任务管理' },
  { path: '/submissions', label: '提交记录' },
  { path: '/logs', label: '操作日志' }
];

const activeMenu = computed(() => `/${route.path.split('/')[1] || 'dashboard'}`);

function handleMenuChange(path) {
  router.push(path);
}

async function handleLogout() {
  await authStore.logout();
  router.replace('/login');
}
</script>
