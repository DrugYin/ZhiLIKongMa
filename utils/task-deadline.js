const formatUtils = require('./format')

function normalizeString(value) {
  return String(value || '').trim()
}

function parseLocalDateTime(dateText, timeText = '00:00') {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizeString(dateText))
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(normalizeString(timeText))

  if (!dateMatch || !timeMatch) {
    return null
  }

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  const second = Number(timeMatch[3] || 0)
  const date = new Date(year, month - 1, day, hour, minute, second, 0)

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
    || date.getSeconds() !== second
  ) {
    return null
  }

  return date
}

function buildTaskDeadlineValue(task = {}) {
  const deadlineDate = normalizeString(task.deadline_date)
  const deadlineTime = normalizeString(task.deadline_time)

  if (deadlineDate && deadlineTime) {
    return `${deadlineDate} ${deadlineTime}`
  }

  return normalizeString(task.deadline)
}

function parseTaskDeadlineValue(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const text = normalizeString(value)
  if (!text) {
    return null
  }

  const localDateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (localDateTimeMatch && !/[zZ]|[+-]\d{2}:\d{2}$/.test(text)) {
    return parseLocalDateTime(
      `${localDateTimeMatch[1]}-${localDateTimeMatch[2]}-${localDateTimeMatch[3]}`,
      `${localDateTimeMatch[4]}:${localDateTimeMatch[5]}:${localDateTimeMatch[6] || '00'}`
    )
  }

  const localDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (localDateMatch) {
    return parseLocalDateTime(text)
  }

  const date = new Date(text)
  if (!Number.isNaN(date.getTime())) {
    return date
  }

  const slashDate = new Date(text.replace(/-/g, '/'))
  return Number.isNaN(slashDate.getTime()) ? null : slashDate
}

function getTaskDeadlineDate(task = {}) {
  const combinedValue = buildTaskDeadlineValue(task)
  return parseTaskDeadlineValue(combinedValue)
}

function formatTaskDeadline(task = {}, emptyText = '未设置截止时间', format = 'YYYY-MM-DD HH:mm') {
  const combinedValue = buildTaskDeadlineValue(task)
  if (!combinedValue) {
    return emptyText
  }

  const deadlineDate = getTaskDeadlineDate(task)
  if (!deadlineDate) {
    return combinedValue
  }

  return formatUtils.formatDate(deadlineDate, format) || combinedValue
}

module.exports = {
  buildTaskDeadlineValue,
  parseTaskDeadlineValue,
  getTaskDeadlineDate,
  formatTaskDeadline
}
