const cloud = require('wx-server-sdk')
const { writeAdminOperationLog } = require('/opt/admin-operation-log')
const { success, failure } = require('/opt/response')
const { verifyAdmin, hasRole } = require('/opt/admin-auth')
const { normalizeString } = require('/opt/utils')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const COLLECTION_NAME = 'draw_records'
const LIMIT = 1000

function normalizeRecord(doc = {}) {
  return {
    _id: doc._id,
    student_openid: doc.student_openid || '',
    student_name: doc.student_name || '',
    prize_name: doc.prize_name || '',
    prize_type: doc.prize_type || 'virtual',
    prize_value: doc.prize_value || 0,
    points_cost: doc.points_cost || 0,
    status: doc.status || 'drawn',
    is_redeemed: doc.is_redeemed === true,
    redeem_id: doc.redeem_id || '',
    redeem_time: doc.redeem_time || null,
    redeem_operator: doc.redeem_operator || '',
    create_time: doc.create_time
  }
}

function matchKeyword(record, keyword) {
  if (!keyword) return true
  const text = [record.student_name, record.prize_name, record.redeem_id].join(' ').toLowerCase()
  return text.includes(keyword.toLowerCase())
}

async function listRecords(event = {}) {
  const keyword = normalizeString(event.keyword)
  const isRedeemed = event.is_redeemed

  const where = {}
  if (isRedeemed === 'true' || isRedeemed === true) {
    where.is_redeemed = true
  } else if (isRedeemed === 'false' || isRedeemed === false) {
    where.is_redeemed = db.command.or(db.command.eq(false), db.command.exists(false))
  }

  const res = await db.collection(COLLECTION_NAME)
    .where(Object.keys(where).length ? where : {})
    .orderBy('create_time', 'desc')
    .limit(LIMIT)
    .get()

  const list = (res.data || [])
    .map(normalizeRecord)
    .filter((item) => matchKeyword(item, keyword))

  return success('获取抽奖记录成功', {
    list,
    total: list.length
  })
}

async function getRecord(event = {}) {
  const id = normalizeString(event._id || event.id)
  if (!id) return failure('缺少记录ID', 400)

  try {
    const res = await db.collection(COLLECTION_NAME).doc(id).get()
    if (!res.data) {
      return failure('记录不存在', 404)
    }
    return success('获取记录详情成功', { record: normalizeRecord(res.data) })
  } catch (error) {
    return failure('记录不存在', 404)
  }
}

async function redeemRecord(event = {}, admin) {
  const id = normalizeString(event._id || event.id)
  if (!id) return failure('缺少记录ID', 400)

  let record
  try {
    const res = await db.collection(COLLECTION_NAME).doc(id).get()
    record = res.data
  } catch (error) {
    return failure('记录不存在', 404)
  }

  if (!record) {
    return failure('记录不存在', 404)
  }

  if (record.is_redeemed) {
    return failure('该记录已兑奖，无需重复操作', 409)
  }

  const now = new Date()
  await db.collection(COLLECTION_NAME).doc(id).update({
    data: {
      is_redeemed: true,
      redeem_time: now,
      redeem_operator: admin.user._id,
      update_time: now
    }
  })

  await writeAdminOperationLog(db, {
    module: 'draw_records',
    action: 'redeem',
    targetId: id,
    targetKey: record.prize_name,
    admin,
    detail: {
      student_name: record.student_name,
      prize_name: record.prize_name,
      prize_type: record.prize_type,
      redeem_id: record.redeem_id
    },
    contextLabel: 'admin-manage-draw-records'
  })

  return success('兑奖成功', {
    _id: id,
    is_redeemed: true,
    redeem_time: now
  })
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin(db)
    if (!adminCheck.success) return adminCheck

    const action = normalizeString(event.action || 'list')

    if (action === 'list') return listRecords(event)
    if (action === 'get') return getRecord(event)
    if (action === 'redeem') return redeemRecord(event, adminCheck)

    return failure('不支持的操作', 400)
  } catch (error) {
    console.error('[admin-manage-draw-records] Error:', error)
    return failure(error.message || '操作失败', 500)
  }
}
