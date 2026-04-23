import { callAdminFunction } from './cloudbase';

export function getOperationLogs(params = {}) {
  return callAdminFunction('admin-manage-logs', {
    action: 'list',
    ...params
  });
}

export function getOperationLogDetail(logId) {
  return callAdminFunction('admin-manage-logs', {
    action: 'get',
    log_id: logId
  });
}
