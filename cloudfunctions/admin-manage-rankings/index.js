/**
 * 后台排行榜管理云函数
 * 功能：查询当前排行榜快照与周榜/月榜历史快照
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const COLLECTION_NAME = 'ranking_snapshots'
const CURRENT_RANK_TYPES = ['week', 'month', 'total']
const PERIOD_RANK_TYPES = ['week', 'month']
const PAGE_SIZE = 100

function success(message, data = {}) {
  return {
    success: true,
    message,
    data
  }
}

function failure(message, errorCode, extra = {}) {
  return {
    success: false,
    message,
    error_code: errorCode,
    ...extra
  }
}

function hasRole(user, role) {
  return Array.isArray(user.roles) && user.roles.includes(role)
}

async function getCallerUid() {
  const identity = auth.getUserInfo() || {}
  return identity.uid || identity.user_id || identity.sub || ''
}

async function verifyAdmin() {
  const uid = await getCallerUid()
  if (!uid) {
    return failure('请先登录', 401)
  }

  const res = await db.collection('users')
    .where({
      admin_auth_uid: uid
    })
    .limit(1)
    .get()
  const user = res.data[0]

  if (!user || !hasRole(user, 'admin')) {
    return failure('当前账号没有后台管理员权限', 403)
  }

  if (user.status === 'disabled' || user.admin_status === 'disabled') {
    return failure('当前管理员账号已被禁用', 403)
  }

  return {
    success: true,
    uid,
    user
  }
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeRankType(value, allowedTypes = CURRENT_RANK_TYPES, fallback = 'week') {
  const rankType = normalizeString(value)
  return allowedTypes.includes(rankType) ? rankType : fallback
}

function normalizePage(value) {
  const page = Number(value || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function normalizePageSize(value) {
  const pageSize = Number(value || 10)
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    return 10
  }

  return Math.min(pageSize, 50)
}

function getTimeValue(value) {
  if (!value) {
    return 0
  }

  if (value instanceof Date) {
    return value.getTime()
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function omitLargeList(snapshot = {}) {
  const {
    list,
    top_three: topThree,
    ...rest
  } = snapshot

  return {
    ...rest,
    top_three: Array.isArray(topThree) ? topThree : [],
    participant_count: Number(snapshot.participant_count || (Array.isArray(list) ? list.length : 0) || 0)
  }
}

function normalizeSnapshot(doc = {}) {
  const list = Array.isArray(doc.list) ? doc.list : []
  const topThree = Array.isArray(doc.top_three) ? doc.top_three : list.slice(0, 3)

  return {
    _id: doc._id,
    rank_type: normalizeString(doc.rank_type),
    snapshot_scope: doc.snapshot_scope || (CURRENT_RANK_TYPES.includes(doc._id) ? 'current' : 'period'),
    period_key: doc.period_key || '',
    period_start: doc.period_start || null,
    period_end: doc.period_end || null,
    period_start_text: doc.period_start_text || '',
    period_end_text: doc.period_end_text || '',
    participant_count: Number(doc.participant_count || list.length || 0),
    top_three: topThree,
    list,
    generated_at: doc.generated_at || null,
    update_time: doc.update_time || doc.generated_at || null
  }
}

async function fetchAllSnapshots() {
  const totalRes = await db.collection(COLLECTION_NAME).count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection(COLLECTION_NAME)
        .skip(skip)
        .limit(PAGE_SIZE)
        .get()
    )
  }

  if (!tasks.length) {
    return []
  }

  const pages = await Promise.all(tasks)
  return pages
    .reduce((result, item) => result.concat(item.data || []), [])
    .map(normalizeSnapshot)
}

async function getCurrentRanking(event = {}) {
  const rankType = normalizeRankType(event.rank_type)

  try {
    const res = await db.collection(COLLECTION_NAME).doc(rankType).get()
    const snapshot = normalizeSnapshot(res.data || {})

    return success('获取当前排行榜成功', {
      snapshot
    })
  } catch (error) {
    return success('暂无当前排行榜快照', {
      snapshot: null,
      rank_type: rankType
    })
  }
}

async function listHistoryRankings(event = {}) {
  const rankType = normalizeRankType(event.rank_type, PERIOD_RANK_TYPES, '')
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size)
  const snapshots = await fetchAllSnapshots()
  const filtered = snapshots
    .filter((item) => item.snapshot_scope === 'period')
    .filter((item) => !rankType || item.rank_type === rankType)
    .sort((left, right) => {
      const rightPeriod = getTimeValue(right.period_start || right.generated_at)
      const leftPeriod = getTimeValue(left.period_start || left.generated_at)
      if (rightPeriod !== leftPeriod) {
        return rightPeriod - leftPeriod
      }

      return getTimeValue(right.update_time) - getTimeValue(left.update_time)
    })

  const start = (page - 1) * pageSize
  const pageList = filtered.slice(start, start + pageSize).map(omitLargeList)

  return success('获取历史排行榜成功', {
    list: pageList,
    page,
    page_size: pageSize,
    total: filtered.length,
    has_more: start + pageSize < filtered.length
  })
}

async function getHistoryRanking(event = {}) {
  const snapshotId = normalizeString(event.snapshot_id)
  if (!snapshotId) {
    return failure('缺少历史快照 ID', 400)
  }

  try {
    const res = await db.collection(COLLECTION_NAME).doc(snapshotId).get()
    const snapshot = normalizeSnapshot(res.data || {})

    if (snapshot.snapshot_scope !== 'period') {
      return failure('该快照不是历史排行榜', 400)
    }

    return success('获取历史排行榜详情成功', {
      snapshot
    })
  } catch (error) {
    return failure('历史排行榜不存在', 404)
  }
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin()
    if (!adminCheck.success) {
      return adminCheck
    }

    const action = normalizeString(event.action || 'current')
    if (action === 'current') {
      return getCurrentRanking(event)
    }

    if (action === 'history') {
      return listHistoryRankings(event)
    }

    if (action === 'history_detail') {
      return getHistoryRanking(event)
    }

    return failure('不支持的排行榜操作', 400)
  } catch (error) {
    console.error('[admin-manage-rankings] Error:', error)
    return failure('排行榜数据获取失败', 500, {
      error: error.message
    })
  }
}
