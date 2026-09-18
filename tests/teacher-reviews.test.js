const assert = require('assert')
const fs = require('fs')

const source = fs.readFileSync('cloudfunctions/get-teacher-reviews/index.js', 'utf8')
const page = fs.readFileSync('miniprogram/pages/teacher/pending/pending.js', 'utf8')
const api = fs.readFileSync('miniprogram/services/api.js', 'utf8')
const service = fs.readFileSync('miniprogram/services/overview.js', 'utf8')
const {
  CURSOR_TTL_MS,
  buildFilterSignature,
  createCursor,
  normalizeReviewFilters,
  parseCursor,
  takeMergedPage,
  toApplicationCard,
  toSubmissionCard
} = require('../cloudfunctions/get-teacher-reviews/helpers')

assert.match(page, /OverviewService\.getTeacherReviews/)
assert.doesNotMatch(page, /ClassService\.getClassApplications/)
assert.doesNotMatch(page, /TaskService\.getSubmissions/)
assert.doesNotMatch(page, /buildAppPromise/)
assert.doesNotMatch(page, /records:\s*\[/)
assert.match(page, /this\._records/)
assert.match(api, /getTeacherReviews/)
assert.match(service, /getTeacherReviews/)
assert.match(source, /include_stats/)
assert.match(source, /next_cursor/)
assert.match(source, /class_options/)
assert.match(source, /record_id/)

assert.deepEqual(normalizeReviewFilters({}), {
  type: 'all',
  status: 'all',
  classId: ''
})
assert.deepEqual(normalizeReviewFilters({
  type: 'submission',
  status: 'processed',
  class_id: 'class-1'
}), {
  type: 'submission',
  status: 'processed',
  classId: 'class-1'
})
assert.equal(normalizeReviewFilters({ type: 'application', status: 'pending' }).type, 'application')
assert.deepEqual(normalizeReviewFilters({ type: 'invalid', status: 'invalid' }), {
  type: 'all',
  status: 'all',
  classId: ''
})

const tiedRecords = [
  { _id: 'b', record_type: 'submission', sort_time: '2026-09-18T08:00:00.000Z' },
  { _id: 'b', record_type: 'application', sort_time: '2026-09-18T08:00:00.000Z' },
  { _id: 'a', record_type: 'application', sort_time: '2026-09-18T08:00:00.000Z' },
  { _id: 'c', record_type: 'submission', sort_time: '2026-09-18T09:00:00.000Z' }
]
const merged = takeMergedPage([
  { source: 'submission', batch: 0, list: tiedRecords.filter((item) => item.record_type === 'submission') },
  { source: 'application', batch: 0, list: tiedRecords.filter((item) => item.record_type === 'application') }
], 3)
assert.deepEqual(merged.list.map((item) => `${item.record_type}:${item._id}`), [
  'submission:c',
  'application:a',
  'application:b'
])
assert.deepEqual(merged.consumed, {
  submission: 1,
  applications: [2]
})
assert.equal(merged.hasMore, true)

const submissionCard = toSubmissionCard({
  _id: 'submission-1',
  images: ['cloud://image'],
  files: [{ file_id: 'cloud://file' }],
  feedback_images: ['cloud://feedback'],
  feedback_files: [{ file_id: 'cloud://feedback-file' }]
})
assert.equal(submissionCard.image_count, 1)
assert.equal(submissionCard.file_count, 1)
assert.equal('images' in submissionCard, false)
assert.equal('files' in submissionCard, false)
assert.equal('feedback_images' in submissionCard, false)
assert.equal('feedback_files' in submissionCard, false)

const applicationCard = toApplicationCard({
  _id: 'application-1',
  class_id: 'class-1',
  student_openid: 'student-1'
}, { class_name: '班级甲' }, {
  user_name: '学生甲',
  grade: '三年级',
  phone: '13800000000'
})
assert.equal(applicationCard.record_type, 'application')
assert.equal(applicationCard.class_name, '班级甲')
assert.equal(applicationCard.student_name, '学生甲')
assert.equal(applicationCard.student_grade, '三年级')

const filters = { type: 'all', status: 'pending', classId: 'class-1' }
const signature = buildFilterSignature(filters)
const now = new Date('2026-09-18T08:00:00.000Z')
const cursor = createCursor({
  snapshot: now.toISOString(),
  signature,
  submissionOffset: 2,
  applicationOffsets: [1, 3],
  total: 12,
  lastKey: {
    sort_time: '2026-09-18T07:00:00.000Z',
    record_type: 'application',
    _id: 'application-9'
  }
})
assert.deepEqual(parseCursor(cursor, signature, now), {
  snapshot: now.toISOString(),
  signature,
  submissionOffset: 2,
  applicationOffsets: [1, 3],
  total: 12,
  lastKey: {
    sort_time: '2026-09-18T07:00:00.000Z',
    record_type: 'application',
    _id: 'application-9'
  }
})
assert.throws(() => parseCursor(cursor, buildFilterSignature({ ...filters, type: 'submission' }), now), /筛选条件/)
assert.throws(() => parseCursor('invalid-cursor', signature, now), /游标/)
assert.throws(() => parseCursor(createCursor({
  snapshot: new Date(now.getTime() - CURSOR_TTL_MS - 1).toISOString(),
  signature,
  submissionOffset: 0,
  applicationOffsets: [],
  total: 0,
  lastKey: null
}), signature, now), /过期/)
