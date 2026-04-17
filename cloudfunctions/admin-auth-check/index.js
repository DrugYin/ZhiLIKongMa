/**
 * 管理员权限校验云函数
 * 功能：校验当前 CloudBase Web Auth 用户是否拥有后台访问权限
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

const DEFAULT_PERMISSIONS = [
  'dashboard:read',
  'config:read',
  'config:write',
  'projects:read',
  'projects:write',
  'users:read',
  'tasks:read',
  'submissions:read',
  'logs:read'
]

function normalizeUser(user, source) {
  return {
    _id: user._id,
    uid: user.uid || user.auth_uid,
    openid: user._openid || user.openid,
    email: user.email,
    phone: user.phone,
    user_name: user.user_name || user.username || user.nick_name || user.nickname || '管理员',
    nick_name: user.nick_name || user.nickname,
    roles: user.roles || ['admin'],
    role: user.role || 'admin',
    status: user.status || 'active',
    permissions: user.permissions || DEFAULT_PERMISSIONS,
    source
  }
}

function getLookupValues(identity, profile) {
  const profileUser = profile || {}
  const metadata = profileUser.user_metadata || {}

  return {
    uid: identity.uid || profileUser.id,
    openid: identity.openId,
    customUserId: identity.customUserId,
    email: profileUser.email,
    phone: profileUser.phone,
    username: metadata.username || metadata.name
  }
}

async function getCurrentIdentity() {
  const identity = auth.getUserInfo() || {}
  let profile = null

  try {
    const profileRes = await auth.getEndUserInfo()
    profile = profileRes.userInfo || null
  } catch (error) {
    console.warn('[admin-auth-check] getEndUserInfo failed:', error.message)
  }

  return getLookupValues(identity, profile)
}

async function getAdminFromAdminUsers(identity) {
  const conditions = []

  if (identity.uid) {
    conditions.push({ uid: identity.uid })
    conditions.push({ auth_uid: identity.uid })
  }

  if (identity.openid) {
    conditions.push({ _openid: identity.openid })
    conditions.push({ openid: identity.openid })
  }

  if (identity.customUserId) {
    conditions.push({ custom_user_id: identity.customUserId })
  }

  if (identity.email) {
    conditions.push({ email: identity.email })
  }

  if (identity.phone) {
    conditions.push({ phone: identity.phone })
  }

  if (identity.username) {
    conditions.push({ username: identity.username })
    conditions.push({ user_name: identity.username })
  }

  if (!conditions.length) {
    return null
  }

  try {
    const res = await db.collection('admin_users')
      .where(_.or(conditions))
      .limit(1)
      .get()

    return res.data[0] || null
  } catch (error) {
    console.warn('[admin-auth-check] query admin_users failed:', error.message)
    return null
  }
}

async function getAdminFromUsers(identity) {
  const conditions = []

  if (identity.openid) {
    conditions.push({ _openid: identity.openid })
  }

  if (identity.uid) {
    conditions.push({ uid: identity.uid })
    conditions.push({ auth_uid: identity.uid })
  }

  if (!conditions.length) {
    return null
  }

  const res = await db.collection('users')
    .where(_.or(conditions))
    .limit(1)
    .get()

  const user = res.data[0]
  if (!user || !Array.isArray(user.roles) || !user.roles.includes('admin')) {
    return null
  }

  return user
}

exports.main = async () => {
  try {
    const identity = await getCurrentIdentity()

    if (!identity.uid && !identity.openid && !identity.customUserId) {
      return {
        success: false,
        message: '请先登录',
        error_code: 401
      }
    }

    const adminFromAdminUsers = await getAdminFromAdminUsers(identity)
    const adminUser = adminFromAdminUsers || await getAdminFromUsers(identity)
    const source = adminFromAdminUsers ? 'admin_users' : 'users'

    if (!adminUser) {
      return {
        success: false,
        message: '当前账号没有后台管理员权限',
        error_code: 403
      }
    }

    if (adminUser.status === 'disabled') {
      return {
        success: false,
        message: '当前管理员账号已被禁用',
        error_code: 403
      }
    }

    const user = normalizeUser(adminUser, source)

    return {
      success: true,
      message: '管理员校验成功',
      data: {
        user,
        permissions: user.permissions
      }
    }
  } catch (error) {
    console.error('[admin-auth-check] Error:', error)
    return {
      success: false,
      message: '管理员校验失败',
      error: error.message
    }
  }
}
