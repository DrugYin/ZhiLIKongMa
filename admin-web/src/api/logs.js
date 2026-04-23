import { callAdminFunction } from './cloudbase';

export function getOperationLogs(params = {}) {
  const { action: logAction, ...restParams } = params;

  return callAdminFunction('admin-manage-logs', {
    ...restParams,
    action: 'list',
    log_action: logAction
  });
}

export function getOperationLogDetail(logId) {
  return callAdminFunction('admin-manage-logs', {
    action: 'get',
    log_id: logId
  });
}
