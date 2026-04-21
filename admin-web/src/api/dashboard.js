import { callAdminFunction } from './cloudbase';

export function getStatistics(params = {}) {
  return callAdminFunction('admin-get-statistics', params);
}

export function refreshRanking() {
  return callAdminFunction('admin-refresh-ranking');
}
