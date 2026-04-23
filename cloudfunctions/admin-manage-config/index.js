/**
 * 后台系统配置管理云函数
 * 功能：对 system_config 集合提供管理员增删改查能力
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { writeAdminOperationLog } = require('../_shared/admin-operation-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const COLLECTION_NAME = 'system_config'
const CONFIG_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/
const VALUE_TYPES = ['string', 'number', 'boolean', 'json']
const POSITIVE_NUMBER_KEYS = ['task_max_submissions', 'class_max_members', 'lottery_daily_limit']
const NON_NEGATIVE_NUMBER_KEYS = [
  'points_register_gift',
  'points_per_task',
  'points_daily_limit',
  'lottery_cost_points',
  'task_overtime_penalty'
]
const DEFAULT_CONFIGS = [
  {
    config_key: 'points_register_gift',
    config_value: 50,
    value_type: 'number',
    category: 'points',
    description: '注册赠送积分',
    sort_order: 10
  },
  {
    config_key: 'points_per_task',
    config_value: 10,
    value_type: 'number',
    category: 'points',
    description: '任务默认奖励积分',
    sort_order: 20
  },
  {
    config_key: 'points_daily_limit',
    config_value: 100,
    value_type: 'number',
    category: 'points',
    description: '每日可获取积分上限',
    sort_order: 30
  },
  {
    config_key: 'lottery_enabled',
    config_value: true,
    value_type: 'boolean',
    category: 'lottery',
    description: '抽奖功能开关',
    sort_order: 40
  },
  {
    config_key: 'lottery_cost_points',
    config_value: 10,
    value_type: 'number',
    category: 'lottery',
    description: '单次抽奖消耗积分',
    sort_order: 50
  },
  {
    config_key: 'lottery_daily_limit',
    config_value: 5,
    value_type: 'number',
    category: 'lottery',
    description: '每日抽奖次数上限',
    sort_order: 60
  },
  {
    config_key: 'class_max_members',
    config_value: 50,
    value_type: 'number',
    category: 'class',
    description: '班级最大成员数',
    sort_order: 70
  },
  {
    config_key: 'class_join_need_approval',
    config_value: true,
    value_type: 'boolean',
    category: 'class',
    description: '加入班级是否需要审批',
    sort_order: 80
  },
  {
    config_key: 'task_max_submissions',
    config_value: 3,
    value_type: 'number',
    category: 'task',
    description: '任务默认最大提交次数',
    sort_order: 90
  },
  {
    config_key: 'task_overtime_penalty',
    config_value: 0.5,
    value_type: 'number',
    category: 'task',
    description: '任务超时扣分系数',
    sort_order: 100
  }
]

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

function normalizeValueType(valueType, configValue) {
  if (VALUE_TYPES.includes(valueType)) {
    return valueType
  }

  if (typeof configValue === 'number') {
    return 'number'
  }

  if (typeof configValue === 'boolean') {
    return 'boolean'
  }

  if (configValue && typeof configValue === 'object') {
    return 'json'
  }

  return 'string'
}

function parseConfigValue(value, valueType) {
  if (valueType === 'number') {
    const numberValue = Number(value)
    if (Number.isNaN(numberValue)) {
      throw new Error('数字类型配置值必须是有效数字')
    }
    return numberValue
  }

  if (valueType === 'boolean') {
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return true
    }

    if (value === false || value === 'false' || value === 0 || value === '0') {
      return false
    }

    throw new Error('布尔类型配置值只能是 true 或 false')
  }

  if (valueType === 'json') {
    if (value && typeof value === 'object') {
      return value
    }

    try {
      return JSON.parse(String(value || ''))
    } catch (error) {
      throw new Error('JSON 类型配置值必须是合法 JSON')
    }
  }

  return String(value ?? '')
}

function normalizeConfigPayload(payload = {}) {
  const configKey = normalizeString(payload.config_key)
  if (!CONFIG_KEY_PATTERN.test(configKey)) {
    throw new Error('配置键需以小写字母开头，仅支持小写字母、数字和下划线，长度 2-64 位')
  }

  const valueType = normalizeValueType(payload.value_type, payload.config_value)
  const configValue = parseConfigValue(payload.config_value, valueType)
  const sortOrder = Number(payload.sort_order || 0)

  if (Number.isNaN(sortOrder)) {
    throw new Error('排序值必须是有效数字')
  }

  assertConfigBusinessRules(configKey, configValue)

  return {
    config_key: configKey,
    config_value: configValue,
    value_type: valueType,
    category: normalizeString(payload.category) || 'general',
    description: normalizeString(payload.description),
    sort_order: sortOrder,
    is_enabled: payload.is_enabled !== false
  }
}

function assertConfigBusinessRules(configKey, configValue) {
  if (POSITIVE_NUMBER_KEYS.includes(configKey) && Number(configValue) <= 0) {
    throw new Error(`${configKey} 必须大于 0`)
  }

  if (NON_NEGATIVE_NUMBER_KEYS.includes(configKey) && Number(configValue) < 0) {
    throw new Error(`${configKey} 不能小于 0`)
  }
}

function normalizeConfigDoc(doc = {}) {
  const valueType = normalizeValueType(doc.value_type, doc.config_value)
  return {
    ...doc,
    value_type: valueType,
    category: doc.category || 'general',
    description: doc.description || '',
    sort_order: Number(doc.sort_order || 0),
    is_enabled: doc.is_enabled !== false
  }
}

function matchKeyword(item, keyword) {
  if (!keyword) {
    return true
  }

  const searchText = [
    item.config_key,
    item.category,
    item.description,
    String(item.config_value)
  ].join(' ').toLowerCase()

  return searchText.includes(keyword.toLowerCase())
}

async function getConfigByKey(configKey) {
  const res = await db.collection(COLLECTION_NAME)
    .where({
      config_key: configKey
    })
    .limit(2)
    .get()

  if (res.data.length > 1) {
    throw new Error(`配置键 ${configKey} 存在重复记录，请先清理数据`)
  }

  return res.data[0] || null
}

async function getConfigById(id) {
  if (!id) {
    return null
  }

  try {
    const res = await db.collection(COLLECTION_NAME).doc(id).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function listConfigs(event = {}) {
  const keyword = normalizeString(event.keyword)
  const category = normalizeString(event.category)
  const res = await db.collection(COLLECTION_NAME)
    .limit(1000)
    .get()

  const list = (res.data || [])
    .map(normalizeConfigDoc)
    .filter((item) => !category || item.category === category)
    .filter((item) => matchKeyword(item, keyword))
    .sort((a, b) => {
      const sortDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0)
      if (sortDiff !== 0) {
        return sortDiff
      }

      return String(a.config_key || '').localeCompare(String(b.config_key || ''))
    })

  return success('获取系统配置成功', {
    list,
    total: list.length,
    defaults: DEFAULT_CONFIGS
  })
}

async function getConfig(event = {}) {
  const configKey = normalizeString(event.config_key)
  if (!configKey) {
    return failure('缺少配置键', 400)
  }

  const config = await getConfigByKey(configKey)
  if (!config) {
    return failure('配置不存在', 404)
  }

  return success('获取系统配置详情成功', {
    config: normalizeConfigDoc(config)
  })
}

async function createConfig(event = {}, admin) {
  const now = new Date()
  const payload = normalizeConfigPayload(event.config || event)
  const existing = await getConfigByKey(payload.config_key)

  if (existing) {
    return failure('配置键已存在，请修改现有配置或更换配置键', 409)
  }

  const addRes = await db.collection(COLLECTION_NAME).add({
    data: {
      ...payload,
      create_time: now,
      update_time: now,
      created_by: admin.user._id,
      updated_by: admin.user._id
    }
  })

  await writeOperationLog('create', {
    _id: addRes._id,
    ...payload
  }, admin)

  return success('创建系统配置成功', {
    _id: addRes._id,
    config: {
      _id: addRes._id,
      ...payload,
      create_time: now,
      update_time: now
    }
  })
}

async function updateConfig(event = {}, admin) {
  const now = new Date()
  const input = event.config || event
  const id = normalizeString(input._id)
  const payload = normalizeConfigPayload(input)
  const current = id ? await getConfigById(id) : await getConfigByKey(payload.config_key)

  if (!current) {
    return failure('配置不存在，无法更新', 404)
  }

  const duplicate = await getConfigByKey(payload.config_key)
  if (duplicate && duplicate._id !== current._id) {
    return failure('配置键已存在，请更换配置键', 409)
  }

  await db.collection(COLLECTION_NAME).doc(current._id).update({
    data: {
      ...payload,
      update_time: now,
      updated_by: admin.user._id
    }
  })

  await writeOperationLog('update', {
    _id: current._id,
    ...payload
  }, admin, current)

  return success('更新系统配置成功', {
    config: {
      _id: current._id,
      ...payload,
      create_time: current.create_time,
      update_time: now
    }
  })
}

async function deleteConfig(event = {}, admin) {
  const id = normalizeString(event._id || event.id)
  const configKey = normalizeString(event.config_key)
  const current = id ? await getConfigById(id) : await getConfigByKey(configKey)

  if (!current) {
    return failure('配置不存在或已删除', 404)
  }

  await db.collection(COLLECTION_NAME).doc(current._id).remove()
  await writeOperationLog('delete', current, admin, current)

  return success('删除系统配置成功', {
    _id: current._id,
    config_key: current.config_key
  })
}

async function seedDefaultConfigs(admin) {
  const results = []

  for (const item of DEFAULT_CONFIGS) {
    const existing = await getConfigByKey(item.config_key)
    if (existing) {
      results.push({
        config_key: item.config_key,
        status: 'exists'
      })
      continue
    }

    const createRes = await createConfig({ config: item }, admin)
    results.push({
      config_key: item.config_key,
      status: createRes.success ? 'created' : 'failed'
    })
  }

  return success('默认系统配置初始化完成', {
    results
  })
}

async function writeOperationLog(action, config, admin, beforeConfig = null) {
  const detail = {
    config_key: config.config_key,
    category: config.category,
    value_type: config.value_type
  }

  if (beforeConfig) {
    detail.before_value = beforeConfig.config_value
  }

  if (action !== 'delete') {
    detail.after_value = config.config_value
  }

  await writeAdminOperationLog(db, {
    module: 'system_config',
    action,
    targetId: config._id || config.config_key,
    targetKey: config.config_key,
    admin,
    detail,
    contextLabel: 'admin-manage-config'
  })
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin()
    if (!adminCheck.success) {
      return adminCheck
    }

    const action = normalizeString(event.action || 'list')
    if (action === 'list') {
      return listConfigs(event)
    }

    if (action === 'get') {
      return getConfig(event)
    }

    if (action === 'create') {
      return createConfig(event, adminCheck)
    }

    if (action === 'update') {
      return updateConfig(event, adminCheck)
    }

    if (action === 'delete') {
      return deleteConfig(event, adminCheck)
    }

    if (action === 'seed_defaults') {
      return seedDefaultConfigs(adminCheck)
    }

    return failure('不支持的系统配置操作', 400)
  } catch (error) {
    console.error('[admin-manage-config] Error:', error)
    return failure(error.message || '系统配置操作失败', 500)
  }
}
