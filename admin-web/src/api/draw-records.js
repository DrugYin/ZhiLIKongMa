import { callAdminFunction } from './cloudbase';

export function getDrawRecordList(params = {}) {
  return callAdminFunction('admin-manage-draw-records', {
    action: 'list',
    ...params
  });
}

export function getDrawRecordDetail(id) {
  return callAdminFunction('admin-manage-draw-records', {
    action: 'get',
    _id: id
  });
}

export function redeemDrawRecord(id) {
  return callAdminFunction('admin-manage-draw-records', {
    action: 'redeem',
    _id: id
  });
}
