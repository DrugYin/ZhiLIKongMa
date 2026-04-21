import { callAdminFunction } from './cloudbase';

export function getUsers(params = {}) {
  return callAdminFunction('admin-get-users', params);
}
