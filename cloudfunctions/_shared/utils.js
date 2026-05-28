function normalizeString(value) {
  return String(value || '').trim()
}

function tryParseInt(value, fallback = 0) {
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

function tryParseFloat(value, fallback = 0) {
  const n = parseFloat(value)
  return Number.isNaN(n) ? fallback : n
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
}

function normalizePage(value) {
  const n = parseInt(value, 10)
  return Number.isNaN(n) || n < 1 ? 1 : n
}

function normalizePageSize(value, maxSize) {
  if (maxSize === undefined) maxSize = 100
  const n = parseInt(value, 10)
  if (Number.isNaN(n) || n < 1) return 20
  return Math.min(n, maxSize)
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  normalizeString,
  tryParseInt,
  tryParseFloat,
  normalizeNumber,
  normalizePage,
  normalizePageSize,
  escapeRegExp
}
