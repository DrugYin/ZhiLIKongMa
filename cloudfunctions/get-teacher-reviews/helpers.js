const CURSOR_TTL_MS = 30 * 60 * 1000

function normalizeOffset(value) {
  const offset = Number(value)
  return Number.isInteger(offset) && offset >= 0 ? offset : null
}

function buildFilterSignature({ type = 'all', status = 'all', classId = '' } = {}) {
  return [type, status, classId].map((value) => String(value || '')).join('|')
}

function normalizeReviewFilters(event = {}) {
  const type = String(event.type || '').trim()
  const status = String(event.status || '').trim()
  return {
    type: ['all', 'submission', 'application'].includes(type) ? type : 'all',
    status: ['all', 'pending', 'processed'].includes(status) ? status : 'all',
    classId: String(event.class_id || '').trim()
  }
}

function createCursor({
  snapshot,
  signature,
  submissionOffset = 0,
  applicationOffsets = [],
  total = 0,
  lastKey = null
}) {
  return Buffer.from(JSON.stringify({
    v: 1,
    s: snapshot,
    f: signature,
    so: submissionOffset,
    ao: applicationOffsets,
    t: total,
    lk: lastKey
  }), 'utf8').toString('base64')
}

function parseCursor(cursor, expectedSignature, now = new Date()) {
  const invalidCursor = (message) => {
    const error = new Error(message)
    error.statusCode = 400
    return error
  }
  let value
  try {
    value = JSON.parse(Buffer.from(String(cursor || ''), 'base64').toString('utf8'))
  } catch (error) {
    throw invalidCursor('分页游标无效')
  }

  const snapshotTime = new Date(value && value.s).getTime()
  const submissionOffset = normalizeOffset(value && value.so)
  const applicationOffsets = value && Array.isArray(value.ao)
    ? value.ao.map(normalizeOffset)
    : null
  const total = normalizeOffset(value && value.t)

  if (!value || value.v !== 1 || !Number.isFinite(snapshotTime) || submissionOffset === null ||
    !applicationOffsets || applicationOffsets.some((item) => item === null) || total === null) {
    throw invalidCursor('分页游标无效')
  }
  if (value.f !== expectedSignature) {
    throw invalidCursor('分页游标与当前筛选条件不匹配')
  }
  if (snapshotTime > now.getTime() + 60 * 1000) {
    throw invalidCursor('分页游标无效')
  }
  if (now.getTime() - snapshotTime > CURSOR_TTL_MS) {
    throw invalidCursor('分页游标已过期')
  }

  return {
    snapshot: new Date(snapshotTime).toISOString(),
    signature: value.f,
    submissionOffset,
    applicationOffsets,
    total,
    lastKey: value.lk || null
  }
}

function getSortTime(item = {}) {
  const time = new Date(item.sort_time || 0).getTime()
  return Number.isNaN(time) ? 0 : time
}

function compareRecords(left, right) {
  const timeDiff = getSortTime(right) - getSortTime(left)
  if (timeDiff) return timeDiff

  const typeDiff = String(left.record_type || '').localeCompare(String(right.record_type || ''))
  if (typeDiff) return typeDiff
  return String(left._id || '').localeCompare(String(right._id || ''))
}

function takeMergedPage(sources = [], pageSize = 20) {
  const applications = []
  let submission = 0
  const candidates = []

  sources.forEach((source) => {
    const batch = Number(source.batch || 0)
    if (source.source === 'application' && applications[batch] === undefined) {
      applications[batch] = 0
    }
    ;(source.list || []).forEach((item) => {
      candidates.push({
        ...item,
        __source: source.source,
        __batch: batch
      })
    })
  })

  const selected = candidates.sort(compareRecords).slice(0, pageSize)
  selected.forEach((item) => {
    if (item.__source === 'submission') {
      submission += 1
    } else if (item.__source === 'application') {
      applications[item.__batch] = Number(applications[item.__batch] || 0) + 1
    }
  })

  return {
    list: selected.map(({ __source, __batch, ...item }) => item),
    consumed: { submission, applications },
    hasMore: candidates.length > selected.length,
    lastKey: selected.length
      ? {
          sort_time: selected[selected.length - 1].sort_time || null,
          record_type: selected[selected.length - 1].record_type || '',
          _id: selected[selected.length - 1]._id || ''
        }
      : null
  }
}

function countItems(value) {
  return Array.isArray(value) ? value.length : 0
}

function toSubmissionCard(item = {}) {
  return {
    _id: item._id,
    record_type: 'submission',
    sort_time: item.submit_time || item.update_time || item.create_time || null,
    task_id: item.task_id || '',
    task_title: item.task_title || '',
    task_points: Number(item.task_points || item.points || 0),
    class_id: item.class_id || '',
    class_name: item.class_name || '',
    student_name: item.student_name || '',
    project_name: item.project_name || '',
    project_code: item.project_code || '',
    status: item.status || 'pending',
    description: item.description || '',
    feedback: item.feedback || '',
    submit_time: item.submit_time || null,
    review_time: item.review_time || null,
    score: item.score === undefined ? null : item.score,
    points_earned: Number(item.points_earned || 0),
    is_overtime: Boolean(item.is_overtime),
    image_count: countItems(item.images),
    file_count: countItems(item.files),
    feedback_image_count: countItems(item.feedback_images),
    feedback_file_count: countItems(item.feedback_files)
  }
}

function toApplicationCard(item = {}, classInfo = {}, student = {}) {
  return {
    _id: item._id,
    record_type: 'application',
    sort_time: item.create_time || item.update_time || null,
    class_id: item.class_id || classInfo._id || '',
    class_name: item.class_name || classInfo.class_name || '',
    project_name: classInfo.project_name || '',
    project_code: classInfo.project_code || '',
    student_name: item.student_name || student.user_name || student.nick_name || '',
    student_avatar: student.avatar_url || '',
    student_grade: student.grade || '',
    student_phone: student.phone || '',
    status: item.status || 'pending',
    apply_reason: item.apply_reason || '',
    review_remark: item.review_remark || '',
    review_time: item.review_time || null,
    create_time: item.create_time || null
  }
}

module.exports = {
  CURSOR_TTL_MS,
  buildFilterSignature,
  compareRecords,
  createCursor,
  normalizeReviewFilters,
  parseCursor,
  takeMergedPage,
  toApplicationCard,
  toSubmissionCard
}
