const RANGE_DAYS = Object.freeze({ '7d': 7, '30d': 30, '90d': 90, '365d': 365 })
const MESSAGE_TYPES = ['task_published', 'task_submitted', 'submission_reviewed']
const UTC_8_MS = 8 * 60 * 60 * 1000

function normalizeRangeType(value) {
  const rangeType = String(value || '').trim()
  return RANGE_DAYS[rangeType] ? rangeType : '30d'
}

function maskOpenid(value) {
  const text = String(value || '')
  return text.length > 8 ? `${text.slice(0, 4)}****${text.slice(-4)}` : '****'
}

function formatDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() + UTC_8_MS).toISOString().slice(0, 10)
}

function createCounter() {
  return { total: 0, success: 0, failed: 0, success_rate: 0 }
}

function finalizeCounter(counter) {
  counter.success_rate = counter.total
    ? Number(((counter.success / counter.total) * 100).toFixed(1))
    : 0
  return counter
}

function buildStatistics(logs = []) {
  const overview = createCounter()
  const templates = MESSAGE_TYPES.reduce((result, type) => {
    result[type] = createCounter()
    return result
  }, {})
  const trendMap = {}
  const errorMap = {}

  logs.forEach((log) => {
    const status = log.status === 'success' ? 'success' : 'failed'
    overview.total += 1
    overview[status] += 1

    if (!templates[log.message_type]) templates[log.message_type] = createCounter()
    templates[log.message_type].total += 1
    templates[log.message_type][status] += 1

    const date = formatDateKey(log.create_time)
    if (date) {
      if (!trendMap[date]) trendMap[date] = { date, success: 0, failed: 0, total: 0 }
      trendMap[date][status] += 1
      trendMap[date].total += 1
    }

    if (status === 'failed') {
      const errorCode = Number(log.error_code || 0)
      errorMap[errorCode] = (errorMap[errorCode] || 0) + 1
    }
  })

  Object.values(templates).forEach(finalizeCounter)
  return {
    overview: finalizeCounter(overview),
    templates,
    trend: Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date)),
    errors: Object.entries(errorMap)
      .map(([errorCode, count]) => ({ error_code: Number(errorCode), count }))
      .sort((a, b) => b.count - a.count || a.error_code - b.error_code)
  }
}

function filterLogs(logs = [], filters = {}) {
  return logs.filter((log) => (
    (!filters.message_type || log.message_type === filters.message_type)
    && (!filters.status || log.status === filters.status)
    && (!filters.miniprogram_state || log.miniprogram_state === filters.miniprogram_state)
    && (filters.error_code === undefined || filters.error_code === '' || Number(log.error_code) === Number(filters.error_code))
  ))
}

module.exports = {
  RANGE_DAYS,
  normalizeRangeType,
  maskOpenid,
  formatDateKey,
  buildStatistics,
  filterLogs
}
