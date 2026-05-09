/**
 * 积分变动明细查询云函数
 * 功能：查询用户的积分变动记录
 * 权限：学生只能查自己的，管理员可查所有
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { getCurrentUser } = require('/opt/auth')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const tcbAuth = app.auth()

const COLLECTION_NAME = 'points_log'

function success(message, data = {}) {
  return {
    success: true,
    message,
    data
  }
}

function failure(message, errorCode) {
  return {
    success: false,
    message,
    error_code: errorCode
  }
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizePage(value) {
  const page = Number(value || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function normalizePageSize(value) {
  const pageSize = Number(value || 20)
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    return 20
  }
  return Math.min(pageSize, 100)
}

function hasRole(user, role) {
  return Array.isArray(user.roles) && user.roles.includes(role)
}

async function getCallerUid() {
  const identity = tcbAuth.getUserInfo() || {}
  return identity.uid || identity.user_id || identity.sub || ''
}

async function verifyAdminByUid() {
  const uid = await getCallerUid()
  if (!uid) return null

  const res = await db.collection('users')
    .where({ admin_auth_uid: uid })
    .limit(1)
    .get()
  const user = res.data[0]

  if (!user || !hasRole(user, 'admin')) return null
  if (user.status === 'disabled' || user.admin_status === 'disabled') return null

  return user
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext()

    const userOpenid = normalizeString(event.user_openid)
    const type = normalizeString(event.type)
    const source = normalizeString(event.source)
    const keyword = normalizeString(event.keyword)
    const startTime = event.start_time
    const endTime = event.end_time
    const page = normalizePage(event.page)
    const pageSize = normalizePageSize(event.page_size || event.pageSize)

    // 权限检查：区分小程序调用和管理后台调用
    let isAdmin = false
    let targetOpenid = OPENID

    if (OPENID) {
      // 小程序端调用，通过 openid 查询用户角色
      const currentUser = await getCurrentUser(db, OPENID)
      isAdmin = hasRole(currentUser, 'admin')
    } else {
      // 管理后台调用，通过 tcb auth 验证管理员身份
      const adminUser = await verifyAdminByUid()
      if (!adminUser) {
        return failure('无管理员权限', 403)
      }
      isAdmin = true
    }

    if (userOpenid && isAdmin) {
      // 管理员可以查指定用户
      targetOpenid = userOpenid
    } else if (userOpenid && userOpenid !== OPENID) {
      // 非管理员不能查别人的
      return failure('无权查看其他用户的积分明细', 403)
    }

    // 构建查询条件
    const queryConditions = []

    // 管理员不指定用户时查全部，否则按 user_openid 过滤
    if (targetOpenid) {
      queryConditions.push({ user_openid: targetOpenid })
    }

    if (type && ['income', 'expense'].includes(type)) {
      queryConditions.push({ type })
    }

    if (source) {
      queryConditions.push({ source })
    }

    if (keyword) {
      queryConditions.push(_.or([
        { user_openid: db.RegExp({ regexp: keyword, options: 'i' }) },
        { remark: db.RegExp({ regexp: keyword, options: 'i' }) },
        { source_id: db.RegExp({ regexp: keyword, options: 'i' }) }
      ]))
    }

    if (startTime || endTime) {
      const timeCondition = {}
      if (startTime) {
        timeCondition._gte = new Date(startTime)
      }
      if (endTime) {
        timeCondition._lte = new Date(endTime)
      }
      queryConditions.push({ create_time: timeCondition })
    }

    const queryData = queryConditions.length > 0 ? _.and(queryConditions) : {}

    // 获取总数
    const countRes = await db.collection(COLLECTION_NAME)
      .where(queryData)
      .count()
    const total = countRes.total || 0

    // 获取列表
    const listRes = await db.collection(COLLECTION_NAME)
      .where(queryData)
      .orderBy('create_time', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return success('获取积分明细成功', {
      list: listRes.data || [],
      total,
      page,
      page_size: pageSize
    })

  } catch (error) {
    console.error('[get-points-log] Error:', error)
    return failure('获取积分明细失败', 500)
  }
}
