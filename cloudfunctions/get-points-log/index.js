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
const USER_COLLECTION = 'users'
const PAGE_SIZE_ALL = 100

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

async function fetchAllUsers() {
  const totalRes = await db.collection(USER_COLLECTION).count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE_ALL) {
    tasks.push(
      db.collection(USER_COLLECTION)
        .skip(skip)
        .limit(PAGE_SIZE_ALL)
        .field({
          _id: true,
          _openid: true,
          admin_auth_uid: true,
          user_name: true,
          nick_name: true,
          nickname: true,
          phone: true
        })
        .get()
    )
  }

  if (!tasks.length) return []

  const pages = await Promise.all(tasks)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

function buildUserIndexes(users = []) {
  return users.reduce((indexes, user) => {
    if (user._id) indexes.byId[user._id] = user
    if (user._openid) indexes.byOpenid[user._openid] = user
    if (user.admin_auth_uid) indexes.byAdminUid[user.admin_auth_uid] = user
    return indexes
  }, { byId: {}, byOpenid: {}, byAdminUid: {} })
}

function getUserDisplayName(user = {}) {
  return user.user_name
    || user.nick_name
    || user.nickname
    || user.phone
    || ''
}

function enrichLogItem(item, userIndexes) {
  const userInfo = userIndexes.byOpenid[item.user_openid]
  const operatorInfo = userIndexes.byOpenid[item.operator_openid]
    || userIndexes.byAdminUid[item.operator_openid]

  return {
    ...item,
    user_name: getUserDisplayName(userInfo) || '',
    operator_name: getUserDisplayName(operatorInfo) || ''
  }
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
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const keywordOr = [
        { user_openid: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
        { remark: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
        { source_id: db.RegExp({ regexp: escapedKeyword, options: 'i' }) }
      ]

      // 管理员搜索时支持按用户名查找
      if (isAdmin) {
        const nameMatchUsers = await db.collection(USER_COLLECTION)
          .where(_.or([
            { user_name: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
            { nick_name: db.RegExp({ regexp: escapedKeyword, options: 'i' }) },
            { nickname: db.RegExp({ regexp: escapedKeyword, options: 'i' }) }
          ]))
          .field({ _openid: true })
          .limit(100)
          .get()

        const matchedOpenids = (nameMatchUsers.data || []).map(u => u._openid).filter(Boolean)
        if (matchedOpenids.length > 0) {
          keywordOr.push({ user_openid: _.in(matchedOpenids) })
        }
      }

      queryConditions.push(_.or(keywordOr))
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

    let list = listRes.data || []

    // 管理后台调用时关联用户名
    if (isAdmin) {
      const allUsers = await fetchAllUsers()
      const userIndexes = buildUserIndexes(allUsers)
      list = list.map(item => enrichLogItem(item, userIndexes))
    }

    return success('获取积分明细成功', {
      list,
      total,
      page,
      page_size: pageSize
    })

  } catch (error) {
    console.error('[get-points-log] Error:', error)
    return failure('获取积分明细失败', 500)
  }
}
