import { callAdminFunction } from './cloudbase';

export function getUsers(params = {}) {
  return callAdminFunction('admin-manage-users', {
    action: 'list',
    ...params
  });
}

export function getUserDetail(id) {
  return callAdminFunction('admin-manage-users', {
    action: 'get',
    _id: id
  });
}

export function updateUser(payload) {
  return callAdminFunction('admin-manage-users', {
    action: 'update',
    user: payload
  });
}
