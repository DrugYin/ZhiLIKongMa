import { callAdminFunction } from './cloudbase';

export function getConfigList(params = {}) {
  return callAdminFunction('admin-get-config', params);
}

export function updateConfig(payload) {
  return callAdminFunction('admin-update-config', payload);
}
