/**
 * 后台训练项目管理云函数
 * 功能：对 projects 集合提供管理员增删改查能力
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const COLLECTION_NAME = 'projects'
const LOG_COLLECTION_NAME = 'operation_logs'
const PROJECT_CODE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/
const VALID_STATUS = ['active', 'inactive']
const DEFAULT_DIFFICULTY_LEVELS = [
  { level: 1, name: '入门', color: '#52c41a' },
  { level: 2, name: '基础', color: '#1890ff' },
  { level: 3, name: '进阶', color: '#faad14' },
  { level: 4, name: '高级', color: '#ff4d4f' },
  { level: 5, name: '专家', color: '#722ed1' }
]
const DEFAULT_PROJECTS = [
  {
    project_name: '编程',
    project_code: 'programming',
    description: '编程基础与进阶训练',
    cover_image: '',
    icon: '',
    difficulty_levels: DEFAULT_DIFFICULTY_LEVELS,
    task_categories: ['基础语法', '算法练习', '项目实战', '竞赛模拟'],
    default_points: 10,
    bonus_multiplier: 1,
    sort_order: 1,
    status: 'active',
    is_default: true
  },
  {
    project_name: '无人机',
    project_code: 'drone',
    description: '无人机操控与编程训练',
    cover_image: '',
    icon: '',
    difficulty_levels: DEFAULT_DIFFICULTY_LEVELS,
    task_categories: ['基础飞行', '航拍技巧', '编程控制', '竞赛模拟'],
    default_points: 10,
    bonus_multiplier: 1,
    sort_order: 2,
    status: 'active',
    is_default: true
  },
  {
    project_name: '机器人',
    project_code: 'robot',
    description: '机器人组装与编程训练',
    cover_image: '',
    icon: '',
    difficulty_levels: DEFAULT_DIFFICULTY_LEVELS,
    task_categories: ['基础组装', '传感器应用', '智能控制', '竞赛模拟'],
    default_points: 10,
    bonus_multiplier: 1,
    sort_order: 3,
    status: 'active',
    is_default: true
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

function normalizeNumber(value, fallback = 0) {
  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? fallback : numberValue
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean)
  }

  return String(value || '')
    .split(/[\n,，]/)
    .map(normalizeString)
    .filter(Boolean)
}

function normalizeDifficultyLevels(value) {
  const list = Array.isArray(value) ? value : DEFAULT_DIFFICULTY_LEVELS
  const normalized = list.map((item) => ({
    level: Number(item.level),
    name: normalizeString(item.name),
    color: normalizeString(item.color) || '#1890ff'
  })).filter((item) => Number.isInteger(item.level) && item.level > 0 && item.name)

  if (!normalized.length) {
    throw new Error('难度等级至少需要一项，且每项必须包含正整数 level 和 name')
  }

  const levelSet = new Set()
  normalized.forEach((item) => {
    if (levelSet.has(item.level)) {
      throw new Error(`难度等级 ${item.level} 重复`)
    }
    levelSet.add(item.level)
  })

  return normalized.sort((a, b) => a.level - b.level)
}

function normalizeProjectPayload(payload = {}) {
  const projectName = normalizeString(payload.project_name)
  const projectCode = normalizeString(payload.project_code)
  const status = VALID_STATUS.includes(payload.status) ? payload.status : 'active'
  const defaultPoints = normalizeNumber(payload.default_points, 0)
  const bonusMultiplier = normalizeNumber(payload.bonus_multiplier, 1)
  const sortOrder = normalizeNumber(payload.sort_order, 0)
  const taskCategories = normalizeStringArray(payload.task_categories)

  if (!projectName) {
    throw new Error('项目名称不能为空')
  }

  if (!PROJECT_CODE_PATTERN.test(projectCode)) {
    throw new Error('项目编码需以小写字母开头，仅支持小写字母、数字和下划线，长度 2-64 位')
  }

  if (defaultPoints < 0) {
    throw new Error('默认积分不能小于 0')
  }

  if (bonusMultiplier < 0) {
    throw new Error('奖励倍率不能小于 0')
  }

  if (!taskCategories.length) {
    throw new Error('任务分类至少需要一项')
  }

  return {
    project_name: projectName,
    project_code: projectCode,
    description: normalizeString(payload.description),
    cover_image: normalizeString(payload.cover_image),
    icon: normalizeString(payload.icon),
    difficulty_levels: normalizeDifficultyLevels(payload.difficulty_levels),
    task_categories: taskCategories,
    default_points: defaultPoints,
    bonus_multiplier: bonusMultiplier,
    sort_order: sortOrder,
    status,
    is_default: Boolean(payload.is_default)
  }
}

function normalizeProjectDoc(doc = {}) {
  return {
    ...doc,
    description: doc.description || '',
    cover_image: doc.cover_image || '',
    icon: doc.icon || '',
    difficulty_levels: Array.isArray(doc.difficulty_levels) && doc.difficulty_levels.length
      ? doc.difficulty_levels
      : DEFAULT_DIFFICULTY_LEVELS,
    task_categories: Array.isArray(doc.task_categories) ? doc.task_categories : [],
    default_points: normalizeNumber(doc.default_points, 0),
    bonus_multiplier: normalizeNumber(doc.bonus_multiplier, 1),
    sort_order: normalizeNumber(doc.sort_order, 0),
    status: VALID_STATUS.includes(doc.status) ? doc.status : 'active',
    is_default: Boolean(doc.is_default)
  }
}

function matchKeyword(item, keyword) {
  if (!keyword) {
    return true
  }

  const searchText = [
    item.project_name,
    item.project_code,
    item.description,
    ...(item.task_categories || [])
  ].join(' ').toLowerCase()

  return searchText.includes(keyword.toLowerCase())
}

async function safeCount(collectionName, queryData = {}) {
  try {
    const res = await db.collection(collectionName).where(queryData).count()
    return res.total || 0
  } catch (error) {
    console.warn(`[admin-manage-projects] count ${collectionName} failed:`, error.message)
    return 0
  }
}

async function getUsageStats(projectCode) {
  const [taskCount, classCount, teacherCount] = await Promise.all([
    safeCount('tasks', {
      project_code: projectCode,
      is_deleted: _.neq(true)
    }),
    safeCount('classes', {
      project_code: projectCode,
      status: _.neq('deleted')
    }),
    safeCount('users', {
      teacher_project_code: projectCode
    })
  ])

  return {
    task_count: taskCount,
    class_count: classCount,
    teacher_count: teacherCount
  }
}

async function getProjectByCode(projectCode) {
  const res = await db.collection(COLLECTION_NAME)
    .where({
      project_code: projectCode
    })
    .limit(2)
    .get()

  if (res.data.length > 1) {
    throw new Error(`项目编码 ${projectCode} 存在重复记录，请先清理数据`)
  }

  return res.data[0] || null
}

async function getProjectById(id) {
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

async function enrichProject(project) {
  const normalized = normalizeProjectDoc(project)
  const usage = await getUsageStats(normalized.project_code)
  return {
    ...normalized,
    ...usage
  }
}

async function listProjects(event = {}) {
  const keyword = normalizeString(event.keyword)
  const status = normalizeString(event.status)
  const res = await db.collection(COLLECTION_NAME)
    .limit(1000)
    .get()

  const filtered = (res.data || [])
    .map(normalizeProjectDoc)
    .filter((item) => !status || item.status === status)
    .filter((item) => matchKeyword(item, keyword))
    .sort((a, b) => {
      const sortDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0)
      if (sortDiff !== 0) {
        return sortDiff
      }

      return String(a.project_code || '').localeCompare(String(b.project_code || ''))
    })

  const list = await Promise.all(filtered.map(enrichProject))

  return success('获取项目配置成功', {
    list,
    total: list.length,
    defaults: DEFAULT_PROJECTS
  })
}

async function getProject(event = {}) {
  const projectCode = normalizeString(event.project_code)
  if (!projectCode) {
    return failure('缺少项目编码', 400)
  }

  const project = await getProjectByCode(projectCode)
  if (!project) {
    return failure('项目不存在', 404)
  }

  return success('获取项目详情成功', {
    project: await enrichProject(project)
  })
}

async function createProject(event = {}, admin) {
  const now = new Date()
  const payload = normalizeProjectPayload(event.project || event)
  const existing = await getProjectByCode(payload.project_code)

  if (existing) {
    return failure('项目编码已存在，请修改现有项目或更换编码', 409)
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

  return success('创建项目成功', {
    _id: addRes._id,
    project: {
      _id: addRes._id,
      ...payload,
      create_time: now,
      update_time: now
    }
  })
}

async function updateProject(event = {}, admin) {
  const now = new Date()
  const input = event.project || event
  const id = normalizeString(input._id)
  const payload = normalizeProjectPayload(input)
  const current = id ? await getProjectById(id) : await getProjectByCode(payload.project_code)

  if (!current) {
    return failure('项目不存在，无法更新', 404)
  }

  if (current.project_code !== payload.project_code) {
    const usage = await getUsageStats(current.project_code)
    if (usage.task_count || usage.class_count || usage.teacher_count) {
      return failure('当前项目已被任务、班级或教师引用，不能修改项目编码', 409, {
        usage
      })
    }
  }

  const duplicate = await getProjectByCode(payload.project_code)
  if (duplicate && duplicate._id !== current._id) {
    return failure('项目编码已存在，请更换编码', 409)
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

  return success('更新项目成功', {
    project: {
      _id: current._id,
      ...payload,
      create_time: current.create_time,
      update_time: now
    }
  })
}

async function deleteProject(event = {}, admin) {
  const id = normalizeString(event._id || event.id)
  const projectCode = normalizeString(event.project_code)
  const current = id ? await getProjectById(id) : await getProjectByCode(projectCode)

  if (!current) {
    return failure('项目不存在或已删除', 404)
  }

  const usage = await getUsageStats(current.project_code)
  if (usage.task_count || usage.class_count || usage.teacher_count) {
    return failure('当前项目已被任务、班级或教师引用，不能删除。建议改为停用。', 409, {
      usage
    })
  }

  await db.collection(COLLECTION_NAME).doc(current._id).remove()
  await writeOperationLog('delete', current, admin, current)

  return success('删除项目成功', {
    _id: current._id,
    project_code: current.project_code
  })
}

async function seedDefaultProjects(admin) {
  const results = []

  for (const item of DEFAULT_PROJECTS) {
    const existing = await getProjectByCode(item.project_code)
    if (existing) {
      results.push({
        project_code: item.project_code,
        status: 'exists'
      })
      continue
    }

    const createRes = await createProject({ project: item }, admin)
    results.push({
      project_code: item.project_code,
      status: createRes.success ? 'created' : 'failed'
    })
  }

  return success('默认项目初始化完成', {
    results
  })
}

async function writeOperationLog(action, project, admin, beforeProject = null) {
  try {
    const detail = {
      project_code: project.project_code,
      project_name: project.project_name,
      status: project.status
    }

    if (beforeProject) {
      detail.before = {
        project_name: beforeProject.project_name,
        project_code: beforeProject.project_code,
        status: beforeProject.status,
        task_categories: beforeProject.task_categories,
        difficulty_levels: beforeProject.difficulty_levels
      }
    }

    if (action !== 'delete') {
      detail.after = {
        project_name: project.project_name,
        project_code: project.project_code,
        status: project.status,
        task_categories: project.task_categories,
        difficulty_levels: project.difficulty_levels
      }
    }

    await db.collection(LOG_COLLECTION_NAME).add({
      data: {
        module: 'projects',
        action,
        target_id: project._id || project.project_code,
        target_key: project.project_code,
        operator_id: admin.user._id,
        operator_name: admin.user.user_name || admin.user.nick_name || '管理员',
        detail,
        create_time: new Date()
      }
    })
  } catch (error) {
    console.warn('[admin-manage-projects] writeOperationLog failed:', error.message)
  }
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin()
    if (!adminCheck.success) {
      return adminCheck
    }

    const action = normalizeString(event.action || 'list')
    if (action === 'list') {
      return listProjects(event)
    }

    if (action === 'get') {
      return getProject(event)
    }

    if (action === 'create') {
      return createProject(event, adminCheck)
    }

    if (action === 'update') {
      return updateProject(event, adminCheck)
    }

    if (action === 'delete') {
      return deleteProject(event, adminCheck)
    }

    if (action === 'seed_defaults') {
      return seedDefaultProjects(adminCheck)
    }

    return failure('不支持的项目操作', 400)
  } catch (error) {
    console.error('[admin-manage-projects] Error:', error)
    return failure(error.message || '项目操作失败', 500)
  }
}
