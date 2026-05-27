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

module.exports = {
  normalizeString,
  tryParseInt,
  tryParseFloat
}
