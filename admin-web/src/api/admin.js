import { callAdminFunction } from './cloudbase';

export function checkAdminAuth() {
  return callAdminFunction('admin-auth-check');
}

export function getOperationLogs(params = {}) {
  return callAdminFunction('admin-get-operation-logs', params);
}
