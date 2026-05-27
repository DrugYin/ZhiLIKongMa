export const PRIZE_TYPE_OPTIONS = [
  { label: '实物奖品', value: 'physical' },
  { label: '虚拟奖品', value: 'virtual' },
  { label: '积分奖品', value: 'points' }
];

export const PRIZE_STATUS_OPTIONS = [
  { label: '上架', value: 'active' },
  { label: '下架', value: 'disabled' }
];

export function getPrizeTypeLabel(type, fallback = '--') {
  if (!type) {
    return fallback;
  }
  return PRIZE_TYPE_OPTIONS.find((item) => item.value === type)?.label || type;
}

export function getPrizeStatusLabel(status, fallback = '--') {
  if (!status) {
    return fallback;
  }
  return PRIZE_STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}
