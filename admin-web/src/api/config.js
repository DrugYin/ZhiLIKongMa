import { callAdminFunction } from './cloudbase';

export function getConfigList(params = {}) {
  return callAdminFunction('admin-manage-config', {
    action: 'list',
    ...params
  });
}

export function getConfigDetail(configKey) {
  return callAdminFunction('admin-manage-config', {
    action: 'get',
    config_key: configKey
  });
}

export function createConfig(payload) {
  return callAdminFunction('admin-manage-config', {
    action: 'create',
    config: payload
  });
}

export function updateConfig(payload) {
  return callAdminFunction('admin-manage-config', {
    action: 'update',
    config: payload
  });
}

export function deleteConfig(payload) {
  return callAdminFunction('admin-manage-config', {
    action: 'delete',
    ...payload
  });
}

export function seedDefaultConfigs() {
  return callAdminFunction('admin-manage-config', {
    action: 'seed_defaults'
  });
}
