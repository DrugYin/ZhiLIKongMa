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
  const percent = Number(value) * 100;
  const formatted = percent.toLocaleString('zh-CN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3
  });
  return `${formatted}%`;
}

export function formatPercentValue(value, fallback = '--') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return `${Number(value).toFixed(1)}%`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Hong_Kong',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

export function formatDateTime(value, fallback = '--') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return dateTimeFormatter.format(date).replace(/\//g, '-');
}
