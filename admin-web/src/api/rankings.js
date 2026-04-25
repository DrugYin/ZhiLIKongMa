import { callAdminFunction } from './cloudbase';

export function getCurrentRanking(rankType = 'week') {
  return callAdminFunction('admin-manage-rankings', {
    action: 'current',
    rank_type: rankType
  });
}

export function getRankingHistory(params = {}) {
  return callAdminFunction('admin-manage-rankings', {
    action: 'history',
    ...params
  });
}

export function getRankingHistoryDetail(snapshotId) {
  return callAdminFunction('admin-manage-rankings', {
    action: 'history_detail',
    snapshot_id: snapshotId
  });
}
