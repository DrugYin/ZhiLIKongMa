const assert = require('assert')
const {
  buildStatistics,
  filterLogs,
  maskOpenid,
  normalizeRangeType
} = require('../cloudfunctions/_shared/subscribe-message-statistics')

const logs = [
  {
    _id: '1',
    message_type: 'task_published',
    status: 'success',
    recipient_openid: 'o1234567890abcdef',
    miniprogram_state: 'trial',
    create_time: new Date('2026-09-15T02:00:00.000Z')
  },
  {
    _id: '2',
    message_type: 'task_published',
    status: 'failed',
    error_code: 43101,
    recipient_openid: 'oabcdef1234567890',
    miniprogram_state: 'trial',
    create_time: new Date('2026-09-15T03:00:00.000Z')
  },
  {
    _id: '3',
    message_type: 'submission_reviewed',
    status: 'success',
    recipient_openid: 'oshort',
    miniprogram_state: 'formal',
    create_time: new Date('2026-09-16T03:00:00.000Z')
  }
]

assert.strictEqual(normalizeRangeType('365d'), '365d')
assert.strictEqual(normalizeRangeType('bad'), '30d')
assert.strictEqual(maskOpenid('o1234567890abcdef'), 'o123****cdef')
assert.strictEqual(maskOpenid('oshort'), '****')

const statistics = buildStatistics(logs)
assert.deepStrictEqual(statistics.overview, {
  total: 3,
  success: 2,
  failed: 1,
  success_rate: 66.7
})
assert.strictEqual(statistics.templates.task_published.total, 2)
assert.strictEqual(statistics.templates.task_published.success_rate, 50)
assert.deepStrictEqual(statistics.errors, [
  { error_code: 43101, count: 1 }
])
assert.deepStrictEqual(statistics.trend.map((item) => item.date), ['2026-09-15', '2026-09-16'])

const filtered = filterLogs(logs, {
  message_type: 'task_published',
  status: 'failed',
  miniprogram_state: 'trial'
})
assert.deepStrictEqual(filtered.map((item) => item._id), ['2'])
