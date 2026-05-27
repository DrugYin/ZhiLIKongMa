import { callAdminFunction } from './cloudbase';

export function getPointsLogList(params = {}) {
  return callAdminFunction('get-points-log', params);
}
