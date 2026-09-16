const cloud = require('wx-server-sdk')
const { verifyAdmin } = require('/opt/admin-auth')
const { success, failure } = require('/opt/response')
const {
  RANGE_DAYS,
  normalizeRangeType,
  maskOpenid,
  buildStatistics,
  filterLogs
} = require('/opt/subscribe-message-statistics')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const COLLECTION = 'subscribe_message_logs'
const PAGE_SIZE = 100
const UTC_8_MS = 8 * 60 * 60 * 1000

function buildRange(rangeType) {
  const days = RANGE_DAYS[rangeType]
  const chinaNow = new Date(Date.now() + UTC_8_MS)
  const end = new Date()
  const start = new Date(Date.UTC(
    chinaNow.getUTCFullYear(), chinaNow.getUTCMonth(), chinaNow.getUTCDate() - days + 1,
    -8, 0, 0, 0
  ))
  return { start, end }
}

async function fetchRangeLogs(rangeType) {
  const range = buildRange(rangeType)
  const query = db.collection(COLLECTION).where({
    create_time: _.gte(range.start).and(_.lte(range.end))
  })
  const countResult = await query.count()
  const total = countResult.total || 0
  const requests = []
  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    requests.push(query.skip(skip).limit(PAGE_SIZE).get())
  }
  const pages = requests.length ? await Promise.all(requests) : []
  return {
    range,
    logs: pages.flatMap((item) => item.data || [])
  }
}

function normalizeLog(log = {}) {
  return {
    ...log,
    recipient_openid: undefined,
    recipient_openid_masked: maskOpenid(log.recipient_openid)
  }
}

async function getStatistics(event) {
  const rangeType = normalizeRangeType(event.range_type)
  const { range, logs } = await fetchRangeLogs(rangeType)
  return success('获取订阅消息统计成功', {
    range_type: rangeType,
    range,
    ...buildStatistics(logs)
  })
}

async function listLogs(event) {
  const rangeType = normalizeRangeType(event.range_type)
  const page = Math.max(Number(event.page || 1), 1)
  const pageSize = Math.min(Math.max(Number(event.page_size || 20), 1), 100)
  const { logs } = await fetchRangeLogs(rangeType)
  const filtered = filterLogs(logs, event).sort((left, right) => (
    new Date(right.create_time).getTime() - new Date(left.create_time).getTime()
  ))
  const start = (page - 1) * pageSize
  return success('获取订阅消息明细成功', {
    list: filtered.slice(start, start + pageSize).map(normalizeLog),
    total: filtered.length,
    page,
    page_size: pageSize
  })
}

async function getLog(event) {
  const logId = String(event.log_id || '').trim()
  if (!logId) return failure('缺少发送记录 ID', 400)
  try {
    const result = await db.collection(COLLECTION).doc(logId).get()
    return success('获取订阅消息详情成功', { log: normalizeLog(result.data || {}) })
  } catch (error) {
    return failure('发送记录不存在', 404)
  }
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin(db)
    if (!adminCheck.success) return adminCheck
    const action = String(event.action || 'statistics').trim()
    if (action === 'statistics') return getStatistics(event)
    if (action === 'list') return listLogs(event)
    if (action === 'get') return getLog(event)
    return failure('不支持的操作', 400)
  } catch (error) {
    console.error('[admin-manage-subscribe-messages] Error:', error)
    return failure('订阅消息统计加载失败', 500, { error: error.message })
  }
}
