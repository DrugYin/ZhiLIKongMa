import cloudbase from '@cloudbase/js-sdk';

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID || 'zhi-li-kong-ma-7gy2aqcr1add21a7';
const region = import.meta.env.VITE_CLOUDBASE_REGION || 'ap-shanghai';
const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY || '';

const cloudbaseConfig = {
  env: envId,
  region,
  auth: {
    detectSessionInUrl: true
  }
};

if (accessKey) {
  cloudbaseConfig.accessKey = accessKey;
}

export const cloudbaseApp = cloudbase.init(cloudbaseConfig);

export const auth = cloudbaseApp.auth({
  persistence: 'local'
});

export function getCloudbaseEnvId() {
  return envId;
}

export async function getLoginState() {
  return auth.getLoginState();
}

export async function getAuthUser() {
  if (typeof auth.getUser === 'function') {
    const response = await auth.getUser();
    if (response?.error) {
      throw response.error;
    }
    return response?.data?.user || null;
  }

  if (typeof auth.getCurrentUser === 'function') {
    return auth.getCurrentUser();
  }

  return null;
}

export async function signInWithPassword(account, password) {
  const loginAccount = account.trim();
  const payload = {
    password
  };

  if (/^\S+@\S+\.\S+$/.test(loginAccount)) {
    payload.email = loginAccount;
  } else if (/^1[3-9]\d{9}$/.test(loginAccount)) {
    payload.phone = loginAccount;
  } else {
    payload.username = loginAccount;
  }

  const response = await auth.signInWithPassword(payload);
  if (response?.error) {
    throw response.error;
  }

  return response?.data || response;
}

export async function callAdminFunction(name, data = {}) {
  const response = await cloudbaseApp.callFunction({
    name,
    data
  });

  const result = response && response.result ? response.result : response;
  if (!result || result.success === false) {
    throw new Error((result && result.message) || `${name} 调用失败`);
  }

  return result.data || result;
}
