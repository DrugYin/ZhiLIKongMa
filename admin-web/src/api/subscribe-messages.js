import { callAdminFunction } from './cloudbase';

export function getSubscribeMessageStatistics(rangeType = '30d') {
  return callAdminFunction('admin-manage-subscribe-messages', {
    action: 'statistics',
    range_type: rangeType
  });
}

export function getSubscribeMessageLogs(params = {}) {
  return callAdminFunction('admin-manage-subscribe-messages', {
    ...params,
    action: 'list'
  });
}

export function getSubscribeMessageLogDetail(logId) {
  return callAdminFunction('admin-manage-subscribe-messages', {
    action: 'get',
    log_id: logId
  });
}
