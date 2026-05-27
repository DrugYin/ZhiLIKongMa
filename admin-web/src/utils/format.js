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
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function formatDateTime(value, fallback = '--') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
