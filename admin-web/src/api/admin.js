import { callAdminFunction } from './cloudbase';

export function checkAdminAuth() {
  return callAdminFunction('admin-auth-check');
}
