const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { writeAdminOperationLog } = require('/opt/admin-operation-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const COLLECTION_NAME = 'prizes'
const PRIZE_TYPES = ['physical', 'virtual', 'points']
const STATUS_VALUES = ['active', 'disabled']

const DEFAULT_PRIZES = [
  {
    name: '精美笔记本',
    description: '限量版学习笔记本',
    image: '',
    type: 'physical',
    stock: 100,
    probability: 0.30,
    value: 50,
    status: 'active',
    sort_order: 1
  },
  {
    name: '积分大礼包',
    description: '50 积分奖励',
    image: '',
    type: 'points',
    stock: 999,
    probability: 0.40,
    value: 50,
    status: 'active',
    sort_order: 2
  },
  {
    name: '无人机体验课',
    description: '免费体验课一节',
    image: '',
    type: 'virtual',
    stock: 20,
    probability: 0.15,
    value: 200,
    status: 'active',
    sort_order: 3
  },
  {
    name: '编程教材',
    description: '编程入门教材一本',
    image: '',
    type: 'physical',
    stock: 30,
    probability: 0.10,
    value: 100,
    status: 'active',
    sort_order: 4
  },
  {
    name: '谢谢参与',
    description: '下次加油',
    image: '',
    type: 'virtual',
    stock: 999,
    probability: 0.05,
    value: 0,
    status: 'active',
    sort_order: 5
  }
]

function success(message, data = {}) {
  return { success: true, message, data }
}

function failure(message, errorCode, extra = {}) {
  return { success: false, message, error_code: errorCode, ...extra }
}

function hasRole(user, role) {
  return Array.isArray(user.roles) && user.roles.includes(role)
}

function tryParseInt(value, fallback) {
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

function tryParseFloat(value, fallback) {
  const n = parseFloat(value)
  return Number.isNaN(n) ? fallback : n
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
    .where({ admin_auth_uid: uid })
    .limit(1)
    .get()
  const user = res.data[0]

  if (!user || !hasRole(user, 'admin')) {
    return failure('当前账号没有后台管理员权限', 403)
  }

  if (user.status === 'disabled' || user.admin_status === 'disabled') {
    return failure('当前管理员账号已被禁用', 403)
  }

  return { success: true, uid, user }
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizePrizePayload(payload = {}) {
  const name = normalizeString(payload.name)
  if (!name) {
    throw new Error('奖品名称不能为空')
  }

  const type = normalizeString(payload.type)
  if (!PRIZE_TYPES.includes(type)) {
    throw new Error(`奖品类型必须是 ${PRIZE_TYPES.join('/')}`)
  }

  const probability = tryParseFloat(payload.probability, 0)
  if (probability < 0 || probability > 1) {
    throw new Error('中奖概率必须在 0-1 之间')
  }

  const stock = tryParseInt(payload.stock, 0)
  if (stock < 0) {
    throw new Error('库存不能为负数')
  }

  const value = tryParseInt(payload.value, 0)
  if (value < 0) {
    throw new Error('奖品价值不能为负数')
  }

  const sortOrder = tryParseInt(payload.sort_order, 0)

  const status = STATUS_VALUES.includes(normalizeString(payload.status))
    ? normalizeString(payload.status)
    : 'active'

  return {
    name,
    description: normalizeString(payload.description),
    image: normalizeString(payload.image),
    type,
    stock,
    probability,
    value,
    status,
    sort_order: sortOrder
  }
}

function normalizePrizeDoc(doc = {}) {
  return {
    ...doc,
    name: doc.name || '',
    description: doc.description || '',
    image: doc.image || '',
    type: PRIZE_TYPES.includes(doc.type) ? doc.type : 'virtual',
    stock: tryParseInt(doc.stock, 0),
    probability: tryParseFloat(doc.probability, 0),
    value: tryParseInt(doc.value, 0),
    status: STATUS_VALUES.includes(doc.status) ? doc.status : 'active',
    sort_order: tryParseInt(doc.sort_order, 0)
  }
}

function matchKeyword(item, keyword) {
  if (!keyword) return true
  const searchText = [item.name, item.description, item.type].join(' ').toLowerCase()
  return searchText.includes(keyword.toLowerCase())
}

async function getPrizeById(id) {
  if (!id) return null
  try {
    const res = await db.collection(COLLECTION_NAME).doc(id).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function listPrizes(event = {}) {
  const keyword = normalizeString(event.keyword)
  const status = normalizeString(event.status)

  const res = await db.collection(COLLECTION_NAME)
    .where({ is_deleted: db.command.neq(true) })
    .orderBy('sort_order', 'asc')
    .orderBy('create_time', 'desc')
    .limit(1000)
    .get()

  const list = (res.data || [])
    .map(normalizePrizeDoc)
    .filter((item) => !status || item.status === status)
    .filter((item) => matchKeyword(item, keyword))

  return success('获取奖品列表成功', {
    list,
    total: list.length,
    defaults: DEFAULT_PRIZES
  })
}

async function getPrize(event = {}) {
  const id = normalizeString(event._id || event.id)
  if (!id) return failure('缺少奖品ID', 400)

  const prize = await getPrizeById(id)
  if (!prize || prize.is_deleted) {
    return failure('奖品不存在或已删除', 404)
  }

  return success('获取奖品详情成功', { prize: normalizePrizeDoc(prize) })
}

async function createPrize(event = {}, admin) {
  const now = new Date()
  const payload = normalizePrizePayload(event.prize || event)

  const addRes = await db.collection(COLLECTION_NAME).add({
    data: {
      ...payload,
      is_deleted: false,
      create_time: now,
      update_time: now,
      created_by: admin.user._id,
      updated_by: admin.user._id
    }
  })

  await writeAdminOperationLog(db, {
    module: 'prizes',
    action: 'create',
    targetId: addRes._id,
    targetKey: payload.name,
    admin,
    detail: payload,
    contextLabel: 'admin-manage-prizes'
  })

  const prize = { _id: addRes._id, ...payload, create_time: now, update_time: now }
  return success('创建奖品成功', { prize })
}

async function updatePrize(event = {}, admin) {
  const now = new Date()
  const input = event.prize || event
  const id = normalizeString(input._id || input.id)
  if (!id) return failure('缺少奖品ID', 400)

  const current = await getPrizeById(id)
  if (!current || current.is_deleted) {
    return failure('奖品不存在或已删除', 404)
  }

  const payload = normalizePrizePayload(input)

  await db.collection(COLLECTION_NAME).doc(id).update({
    data: {
      ...payload,
      update_time: now,
      updated_by: admin.user._id
    }
  })

  await writeAdminOperationLog(db, {
    module: 'prizes',
    action: 'update',
    targetId: id,
    targetKey: current.name,
    admin,
    detail: { before: normalizePrizeDoc(current), after: payload },
    contextLabel: 'admin-manage-prizes'
  })

  return success('更新奖品成功', {
    prize: { _id: id, ...payload, create_time: current.create_time, update_time: now }
  })
}

async function deletePrize(event = {}, admin) {
  const id = normalizeString(event._id || event.id)
  if (!id) return failure('缺少奖品ID', 400)

  const current = await getPrizeById(id)
  if (!current || current.is_deleted) {
    return failure('奖品不存在或已删除', 404)
  }

  const now = new Date()
  await db.collection(COLLECTION_NAME).doc(id).update({
    data: {
      is_deleted: true,
      status: 'disabled',
      update_time: now,
      updated_by: admin.user._id
    }
  })

  await writeAdminOperationLog(db, {
    module: 'prizes',
    action: 'delete',
    targetId: id,
    targetKey: current.name,
    admin,
    detail: { name: current.name, type: current.type },
    contextLabel: 'admin-manage-prizes'
  })

  return success('删除奖品成功', { _id: id })
}

async function togglePrizeStatus(event = {}, admin) {
  const id = normalizeString(event._id || event.id)
  if (!id) return failure('缺少奖品ID', 400)

  const current = await getPrizeById(id)
  if (!current || current.is_deleted) {
    return failure('奖品不存在或已删除', 404)
  }

  const newStatus = current.status === 'active' ? 'disabled' : 'active'
  const now = new Date()

  await db.collection(COLLECTION_NAME).doc(id).update({
    data: {
      status: newStatus,
      update_time: now,
      updated_by: admin.user._id
    }
  })

  await writeAdminOperationLog(db, {
    module: 'prizes',
    action: newStatus === 'active' ? 'enable' : 'disable',
    targetId: id,
    targetKey: current.name,
    admin,
    detail: { name: current.name, before: current.status, after: newStatus },
    contextLabel: 'admin-manage-prizes'
  })

  return success(`${newStatus === 'active' ? '上架' : '下架'}成功`, {
    _id: id,
    status: newStatus
  })
}

async function seedDefaultPrizes(admin) {
  const results = []

  for (const item of DEFAULT_PRIZES) {
    const existing = await db.collection(COLLECTION_NAME)
      .where({ name: item.name, is_deleted: db.command.neq(true) })
      .count()

    if (existing.total > 0) {
      results.push({ name: item.name, status: 'exists' })
      continue
    }

    try {
      const createRes = await createPrize({ prize: item }, admin)
      results.push({ name: item.name, status: createRes.success ? 'created' : 'failed' })
    } catch (error) {
      results.push({ name: item.name, status: 'failed', error: error.message })
    }
  }

  return success('默认奖品初始化完成', { results })
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin()
    if (!adminCheck.success) return adminCheck

    const action = normalizeString(event.action || 'list')

    if (action === 'list') return listPrizes(event)
    if (action === 'get') return getPrize(event)
    if (action === 'create') return createPrize(event, adminCheck)
    if (action === 'update') return updatePrize(event, adminCheck)
    if (action === 'delete') return deletePrize(event, adminCheck)
    if (action === 'toggle') return togglePrizeStatus(event, adminCheck)
    if (action === 'seed_defaults') return seedDefaultPrizes(adminCheck)

    return failure('不支持的奖品操作', 400)
  } catch (error) {
    console.error('[admin-manage-prizes] Error:', error)
    return failure(error.message || '奖品操作失败', 500)
  }
}
