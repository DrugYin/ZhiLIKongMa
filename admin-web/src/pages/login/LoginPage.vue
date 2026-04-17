<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-brand">智</div>
      <h1>智慧控码后台管理</h1>
      <p>
        使用 CloudBase Web Auth 完成账号登录，再通过
        <code>admin-auth-check</code> 校验后台管理员权限。
      </p>
      <t-alert
        theme="info"
        title="登录方式"
        message="支持用户名、邮箱或手机号加密码登录。请先在 CloudBase 身份认证中启用用户名/密码登录，并配置 Web 访问密钥。"
      />
      <t-form class="login-form" label-align="top" @submit="handleLogin">
        <t-form-item label="账号">
          <t-input
            v-model="form.account"
            clearable
            placeholder="请输入用户名、邮箱或手机号"
            @enter="handleLogin"
          />
        </t-form-item>
        <t-form-item label="密码">
          <t-input
            v-model="form.password"
            clearable
            type="password"
            placeholder="请输入密码"
            @enter="handleLogin"
          />
        </t-form-item>
        <t-button block theme="primary" type="submit" :loading="authStore.loading">
          登录后台
        </t-button>
      </t-form>
      <button class="login-check" type="button" @click="handleCheck">
        已有登录态？重新校验管理员权限
      </button>
    </section>
  </main>
</template>

<script setup>
import { reactive } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const form = reactive({
  account: '',
  password: ''
});

function getRedirectPath() {
  return route.query.redirect || '/dashboard';
}

async function handleLogin(event) {
  event?.preventDefault?.();
  const account = form.account.trim();
  const password = form.password;

  if (!account) {
    MessagePlugin.warning('请输入账号');
    return;
  }

  if (!password) {
    MessagePlugin.warning('请输入密码');
    return;
  }

  try {
    await authStore.loginWithPassword({ account, password });
    MessagePlugin.success('登录成功');
    router.replace(getRedirectPath());
  } catch (error) {
    MessagePlugin.error(error.message || '登录失败');
  }
}

async function handleCheck() {
  await authStore.bootstrap();
  if (authStore.isAdmin) {
    MessagePlugin.success('管理员校验成功');
    router.replace(getRedirectPath());
    return;
  }
  MessagePlugin.warning('当前登录态未通过管理员校验');
}
</script>
