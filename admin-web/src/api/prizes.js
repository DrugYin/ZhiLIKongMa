import { callAdminFunction } from './cloudbase';

export function getPrizeList(params = {}) {
  return callAdminFunction('admin-manage-prizes', {
    action: 'list',
    ...params
  });
}

export function getPrizeDetail(id) {
  return callAdminFunction('admin-manage-prizes', {
    action: 'get',
    _id: id
  });
}

export function createPrize(payload) {
  return callAdminFunction('admin-manage-prizes', {
    action: 'create',
    prize: payload
  });
}

export function updatePrize(payload) {
  return callAdminFunction('admin-manage-prizes', {
    action: 'update',
    prize: payload
  });
}

export function deletePrize(id) {
  return callAdminFunction('admin-manage-prizes', {
    action: 'delete',
    _id: id
  });
}

export function togglePrizeStatus(id) {
  return callAdminFunction('admin-manage-prizes', {
    action: 'toggle',
    _id: id
  });
}

export function seedDefaultPrizes() {
  return callAdminFunction('admin-manage-prizes', {
    action: 'seed_defaults'
  });
}
