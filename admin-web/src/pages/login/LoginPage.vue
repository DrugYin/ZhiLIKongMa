<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-brand">智</div>
      <h1>智慧控码后台管理</h1>
      <p>
        后台登录将使用 CloudBase Web Auth 登录态，并通过
        <code>admin-auth-check</code> 云函数校验管理员权限。
      </p>
      <t-alert
        theme="warning"
        title="待接入登录方式"
        message="请先在 CloudBase 身份认证中启用 Web 登录方式，再补齐登录表单。"
      />
      <t-space direction="vertical" size="16px" class="login-actions">
        <t-button block theme="primary" :loading="authStore.loading" @click="handleCheck">
          检查当前登录态
        </t-button>
      </t-space>
    </section>
  </main>
</template>

<script setup>
import { MessagePlugin } from 'tdesign-vue-next';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

async function handleCheck() {
  await authStore.bootstrap();
  if (authStore.isAdmin) {
    MessagePlugin.success('管理员校验成功');
    router.replace(route.query.redirect || '/dashboard');
    return;
  }
  MessagePlugin.warning('当前登录态未通过管理员校验');
}
</script>
