import cloudbase from '@cloudbase/js-sdk';

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID || 'zhi-li-kong-ma-7gy2aqcr1add21a7';

export const cloudbaseApp = cloudbase.init({
  env: envId
});

export const auth = cloudbaseApp.auth();

export function getCloudbaseEnvId() {
  return envId;
}

export async function getLoginState() {
  return auth.getLoginState();
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
