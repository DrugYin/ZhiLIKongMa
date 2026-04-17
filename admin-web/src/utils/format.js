export function formatNumber(value, fallback = '--') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return Number(value).toLocaleString('zh-CN');
}

export function formatPercent(value, fallback = '--') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return `${Number(value).toFixed(1)}%`;
}
