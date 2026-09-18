const cloud = require('wx-server-sdk')
const { verifyTeacherRole } = require('/opt/auth')
const { chunkList } = require('/opt/membership')
const { success, failure } = require('/opt/response')
const {
  buildFilterSignature,
  createCursor,
  normalizeReviewFilters,
  parseCursor,
  takeMergedPage,
  toApplicationCard,
  toSubmissionCard
} = require('./helpers')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const CLASS_BATCH_SIZE = 20
const CLASS_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

const SUBMISSION_CARD_FIELDS = {
  _id: true,
  task_id: true,
  task_title: true,
  task_points: true,
  points: true,
  class_id: true,
  class_name: true,
  student_name: true,
  project_name: true,
  project_code: true,
  status: true,
  description: true,
  feedback: true,
  submit_time: true,
  update_time: true,
  create_time: true,
  review_time: true,
  score: true,
  points_earned: true,
  is_overtime: true,
  images: true,
  files: true,
  feedback_images: true,
  feedback_files: true
}

const APPLICATION_CARD_FIELDS = {
  _id: true,
  class_id: true,
  class_name: true,
  student_openid: true,
  student_name: true,
  status: true,
  apply_reason: true,
  review_remark: true,
  review_time: true,
  create_time: true,
  update_time: true
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value || '').trim()
  return allowed.includes(normalized) ? normalized : fallback
}

function createStatusCondition(status) {
  if (status === 'pending') return 'pending'
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'processed') return _.in(['approved', 'rejected'])
  return null
}

function withStatus(queryData, status) {
  const condition = createStatusCondition(status)
  return condition ? { ...queryData, status: condition } : queryData
}

async function getOwnedClasses(openid) {
  const queryData = {
    teacher_openid: openid,
    status: _.neq('deleted')
  }
  const totalRes = await db.collection('classes').where(queryData).count()
  const requests = []
  for (let skip = 0; skip < Number(totalRes.total || 0); skip += CLASS_PAGE_SIZE) {
    requests.push(
      db.collection('classes')
        .where(queryData)
        .orderBy('update_time', 'desc')
        .skip(skip)
        .limit(CLASS_PAGE_SIZE)
        .field({
          _id: true,
          class_name: true,
          project_name: true,
          project_code: true
        })
        .get()
    )
  }
  if (!requests.length) return []
  const pages = await Promise.all(requests)
  return pages.reduce((result, page) => result.concat(page.data || []), [])
}

function buildSubmissionQuery(openid, filters, snapshot) {
  const queryData = {
    teacher_openid: openid,
    submit_time: _.lte(snapshot)
  }
  if (filters.classId) queryData.class_id = filters.classId
  return withStatus(queryData, filters.status)
}

function buildApplicationQuery(classIds, filters, snapshot) {
  return withStatus({
    class_id: _.in(classIds),
    create_time: _.lte(snapshot)
  }, filters.status)
}

async function querySubmissionCards(openid, filters, snapshot, offset, pageSize) {
  if (filters.type === 'application') return []
  const res = await db.collection('submissions')
    .where(buildSubmissionQuery(openid, filters, snapshot))
    .orderBy('submit_time', 'desc')
    .orderBy('_id', 'asc')
    .skip(offset)
    .limit(pageSize + 1)
    .field(SUBMISSION_CARD_FIELDS)
    .get()
  return (res.data || []).map(toSubmissionCard)
}

async function queryApplicationCards(classBatches, classMap, filters, snapshot, offsets, pageSize) {
  if (filters.type === 'submission') return []
  const sources = await Promise.all(classBatches.map(async (classIds, batch) => {
    const res = await db.collection('class_join_applications')
      .where(buildApplicationQuery(classIds, filters, snapshot))
      .orderBy('create_time', 'desc')
      .orderBy('_id', 'asc')
      .skip(Number(offsets[batch] || 0))
      .limit(pageSize + 1)
      .field(APPLICATION_CARD_FIELDS)
      .get()
    return {
      source: 'application',
      batch,
      list: res.data || []
    }
  }))

  const studentOpenids = Array.from(new Set(
    sources.reduce((result, source) => result.concat(
      source.list.map((item) => item.student_openid).filter(Boolean)
    ), [])
  ))
  const studentRequests = chunkList(studentOpenids, CLASS_BATCH_SIZE).map((openids) => (
    db.collection('users').where({
      _openid: _.in(openids)
    }).field({
      _openid: true,
      user_name: true,
      nick_name: true,
      avatar_url: true,
      grade: true,
      phone: true
    }).get()
  ))
  const studentPages = studentRequests.length ? await Promise.all(studentRequests) : []
  const studentMap = studentPages.reduce((result, page) => {
    ;(page.data || []).forEach((student) => {
      result[student._openid] = student
    })
    return result
  }, {})

  return sources.map((source) => ({
    ...source,
    list: source.list.map((item) => toApplicationCard(
      item,
      classMap[item.class_id],
      studentMap[item.student_openid]
    ))
  }))
}

async function countSubmissions(openid, filters, status) {
  if (filters.type === 'application') return 0
  const queryData = { teacher_openid: openid }
  if (filters.classId) queryData.class_id = filters.classId
  const res = await db.collection('submissions').where(withStatus(queryData, status)).count()
  return Number(res.total || 0)
}

async function countApplications(classBatches, filters, status) {
  if (filters.type === 'submission' || !classBatches.length) return 0
  const results = await Promise.all(classBatches.map((classIds) => (
    db.collection('class_join_applications')
      .where(withStatus({ class_id: _.in(classIds) }, status))
      .count()
  )))
  return results.reduce((sum, item) => sum + Number(item.total || 0), 0)
}

async function getStats(openid, classBatches, filters) {
  const statuses = ['all', 'pending', 'approved', 'rejected']
  const values = await Promise.all(statuses.map(async (status) => {
    const [submissionCount, applicationCount] = await Promise.all([
      countSubmissions(openid, filters, status),
      countApplications(classBatches, filters, status)
    ])
    return { submissionCount, applicationCount }
  }))

  return {
    total: values[0].submissionCount + values[0].applicationCount,
    pending: values[1].submissionCount + values[1].applicationCount,
    task_pending: values[1].submissionCount,
    join_pending: values[1].applicationCount,
    approved: values[2].submissionCount + values[2].applicationCount,
    rejected: values[3].submissionCount + values[3].applicationCount
  }
}

function getFilteredTotal(stats, status) {
  if (status === 'pending') return stats.pending
  if (status === 'processed') return stats.approved + stats.rejected
  return stats.total
}

async function getDetail(recordType, recordId, openid, classMap) {
  const collectionName = recordType === 'submission' ? 'submissions' : 'class_join_applications'
  let record
  try {
    const res = await db.collection(collectionName).doc(recordId).get()
    record = res.data || null
  } catch (error) {
    record = null
  }
  if (!record) {
    const error = new Error('审核记录不存在')
    error.statusCode = 404
    throw error
  }

  const allowed = recordType === 'submission'
    ? record.teacher_openid === openid
    : Boolean(classMap[record.class_id])
  if (!allowed) {
    const error = new Error('无权查看该审核记录')
    error.statusCode = 403
    throw error
  }

  if (recordType === 'application' && record.student_openid) {
    const studentRes = await db.collection('users').where({
      _openid: record.student_openid
    }).field({
      user_name: true,
      nick_name: true,
      avatar_url: true,
      grade: true,
      phone: true
    }).limit(1).get()
    const student = studentRes.data && studentRes.data[0] || {}
    return {
      ...record,
      student_name: record.student_name || student.user_name || student.nick_name || '',
      student_avatar: student.avatar_url || '',
      student_grade: student.grade || '',
      student_phone: student.phone || '',
      class_name: record.class_name || classMap[record.class_id].class_name || ''
    }
  }
  return record
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const teacher = await verifyTeacherRole(db, OPENID)
    if (!teacher) return failure('仅教师可以查看审核中心', 403)

    const classes = await getOwnedClasses(OPENID)
    const classMap = classes.reduce((result, item) => {
      result[item._id] = item
      return result
    }, {})

    const recordId = String(event.record_id || '').trim()
    if (recordId) {
      const recordType = normalizeEnum(event.record_type, ['submission', 'application'], '')
      if (!recordType) return failure('审核记录类型无效', 400)
      const detail = await getDetail(recordType, recordId, OPENID, classMap)
      return success('获取审核详情成功', { detail })
    }

    const filters = normalizeReviewFilters(event)
    if (filters.classId && !classMap[filters.classId]) {
      return failure('班级筛选无效', 400)
    }

    const pageSize = Math.min(Math.max(Number(event.page_size || DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE)
    const includeStats = event.include_stats === true || event.include_stats === 'true'
    const targetClassIds = filters.classId ? [filters.classId] : classes.map((item) => item._id)
    const classBatches = chunkList(targetClassIds, CLASS_BATCH_SIZE)
    const signature = buildFilterSignature(filters)
    const now = new Date()
    let state = {
      snapshot: now.toISOString(),
      signature,
      submissionOffset: 0,
      applicationOffsets: classBatches.map(() => 0),
      total: 0,
      lastKey: null
    }

    if (event.cursor) {
      state = parseCursor(event.cursor, signature, now)
      if (state.applicationOffsets.length !== classBatches.length) {
        return failure('分页游标已失效，请重新加载', 400)
      }
    }

    const snapshot = new Date(state.snapshot)
    let stats = null
    if (!event.cursor || includeStats) {
      stats = await getStats(OPENID, classBatches, filters)
      state.total = getFilteredTotal(stats, filters.status)
    }

    const [submissionCards, applicationSources] = await Promise.all([
      querySubmissionCards(OPENID, filters, snapshot, state.submissionOffset, pageSize),
      queryApplicationCards(
        classBatches,
        classMap,
        filters,
        snapshot,
        state.applicationOffsets,
        pageSize
      )
    ])
    const sources = applicationSources.slice()
    if (filters.type !== 'application') {
      sources.push({ source: 'submission', batch: 0, list: submissionCards })
    }
    const page = takeMergedPage(sources, pageSize)
    const nextSubmissionOffset = state.submissionOffset + page.consumed.submission
    const nextApplicationOffsets = state.applicationOffsets.map((offset, index) => (
      offset + Number(page.consumed.applications[index] || 0)
    ))
    const nextCursor = page.hasMore
      ? createCursor({
          snapshot: state.snapshot,
          signature,
          submissionOffset: nextSubmissionOffset,
          applicationOffsets: nextApplicationOffsets,
          total: state.total,
          lastKey: page.lastKey
        })
      : ''

    return success('获取教师审核记录成功', {
      list: page.list,
      page_size: pageSize,
      total: state.total,
      has_more: page.hasMore,
      next_cursor: nextCursor,
      class_options: includeStats
        ? classes.map((item) => ({ value: item._id, label: item.class_name || '未命名班级' }))
        : [],
      stats: includeStats ? stats : null
    })
  } catch (error) {
    console.error('[get-teacher-reviews] Error:', error)
    return failure(error.message || '获取教师审核记录失败', error.statusCode || 500, {
      error: error.message
    })
  }
}
