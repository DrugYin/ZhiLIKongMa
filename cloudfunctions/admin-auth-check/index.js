/**
 * 管理员权限校验云函数
 * 功能：校验当前 CloudBase Web Auth 用户是否绑定到 users 表中的管理员账号
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
  'users:write',
  'tasks:read',
  'submissions:read',
  'logs:read'
]

function hasAdminRole(user) {
  return Array.isArray(user.roles) && user.roles.includes('admin')
}

function isDisabled(user) {
  return user.status === 'disabled' || user.admin_status === 'disabled'
}

function normalizePhone(phone) {
  if (!phone) {
    return ''
  }

  const digits = String(phone).replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('86')) {
    return digits.slice(2)
  }

  return digits
}

function getPhoneCandidates(phone) {
  const normalized = normalizePhone(phone)
  const candidates = new Set()

  if (phone) {
    candidates.add(String(phone))
  }

  if (normalized) {
    candidates.add(normalized)
    candidates.add(`+86 ${normalized}`)
    candidates.add(`+86${normalized}`)
  }

  return Array.from(candidates)
}

function normalizeUser(user) {
  return {
    _id: user._id,
    openid: user._openid,
    phone: user.phone,
    user_name: user.user_name || user.nick_name || user.nickname || '管理员',
    nick_name: user.nick_name || user.nickname,
    roles: user.roles || [],
    admin_role: user.admin_role || 'admin',
    admin_status: user.admin_status || user.status || 'active',
    admin_auth_uid: user.admin_auth_uid,
    permissions: user.admin_permissions || user.permissions || DEFAULT_PERMISSIONS,
    source: 'users'
  }
}

function getProfilePhone(profile) {
  return profile?.phone
    || profile?.phone_number
    || profile?.phoneNumber
    || profile?.user?.phone
    || profile?.user?.phone_number
    || ''
}

function getProfileUid(profile) {
  return profile?.id
    || profile?.uid
    || profile?.user_id
    || profile?.sub
    || profile?.user?.id
    || profile?.user?.uid
    || profile?.user?.user_id
    || profile?.user?.sub
    || ''
}

function normalizeProfileResponse(profileRes) {
  if (!profileRes) {
    return null
  }

  if (profileRes.userInfo) {
    return profileRes.userInfo
  }

  if (profileRes.user) {
    return profileRes.user
  }

  if (profileRes.data?.userInfo) {
    return profileRes.data.userInfo
  }

  if (profileRes.data?.user) {
    return profileRes.data.user
  }

  if (profileRes.data && typeof profileRes.data === 'object') {
    return profileRes.data
  }

  return profileRes
}

async function getCurrentIdentity() {
  const identity = auth.getUserInfo() || {}
  const uid = identity.uid || identity.user_id || identity.sub || ''
  let profile = null

  try {
    const profileRes = uid
      ? await auth.getEndUserInfo(uid)
      : await auth.getEndUserInfo()
    profile = normalizeProfileResponse(profileRes)
  } catch (error) {
    console.warn('[admin-auth-check] getEndUserInfo failed:', error.message)
  }

  if (uid && !getProfilePhone(profile) && typeof auth.queryUserInfo === 'function') {
    try {
      const queryRes = await auth.queryUserInfo({ uid })
      profile = normalizeProfileResponse(queryRes) || profile
    } catch (error) {
      console.warn('[admin-auth-check] queryUserInfo failed:', error.message)
    }
  }

  return {
    uid: uid || getProfileUid(profile),
    phone: getProfilePhone(profile),
    profile
  }
}

async function getUserByAdminAuthUid(uid) {
  const res = await db.collection('users')
    .where({
      admin_auth_uid: uid
    })
    .limit(2)
    .get()

  if (res.data.length > 1) {
    throw new Error('多个用户绑定了同一个后台登录账号，请检查 users.admin_auth_uid')
  }

  return res.data[0] || null
}

async function getBindableAdminByPhone(phone) {
  const phoneCandidates = getPhoneCandidates(phone)

  if (!phoneCandidates.length) {
    return {
      user: null,
      message: '当前后台登录账号没有手机号，无法自动绑定 users 用户'
    }
  }

  const res = await db.collection('users')
    .where({
      phone: _.in(phoneCandidates)
    })
    .limit(10)
    .get()

  const adminUsers = res.data.filter(hasAdminRole)

  if (!adminUsers.length) {
    return {
      user: null,
      message: '当前手机号没有对应的后台管理员用户，请先在 users.roles 中加入 admin'
    }
  }

  if (adminUsers.length > 1) {
    return {
      user: null,
      message: '当前手机号匹配到多个管理员用户，请先清理 users.phone 重复数据'
    }
  }

  return {
    user: adminUsers[0],
    message: ''
  }
}

async function bindAdminAuthUid(user, uid) {
  if (user.admin_auth_uid && user.admin_auth_uid !== uid) {
    return {
      success: false,
      message: '该管理员用户已绑定其他后台登录账号'
    }
  }

  if (user.admin_auth_uid === uid) {
    return {
      success: true
    }
  }

  await db.collection('users')
    .doc(user._id)
    .update({
      data: {
        admin_auth_uid: uid,
        admin_auth_bind_time: new Date(),
        update_time: new Date()
      }
    })

  user.admin_auth_uid = uid

  return {
    success: true
  }
}

function assertAdminUser(user) {
  if (!user || !hasAdminRole(user)) {
    return {
      success: false,
      message: '当前账号没有后台管理员权限',
      error_code: 403
    }
  }

  if (isDisabled(user)) {
    return {
      success: false,
      message: '当前管理员账号已被禁用',
      error_code: 403
    }
  }

  return {
    success: true
  }
}

exports.main = async () => {
  try {
    const identity = await getCurrentIdentity()

    if (!identity.uid) {
      return {
        success: false,
        message: '请先登录',
        error_code: 401
      }
    }

    let user = await getUserByAdminAuthUid(identity.uid)
    let bindMessage = ''

    if (!user) {
      const bindable = await getBindableAdminByPhone(identity.phone)
      user = bindable.user
      bindMessage = bindable.message

      if (user) {
        const pendingAdminCheck = assertAdminUser(user)
        if (!pendingAdminCheck.success) {
          return pendingAdminCheck
        }

        const bindResult = await bindAdminAuthUid(user, identity.uid)
        if (!bindResult.success) {
          return {
            success: false,
            message: bindResult.message,
            error_code: 403
          }
        }
      }
    }

    const adminCheck = assertAdminUser(user)
    if (!adminCheck.success) {
      return {
        ...adminCheck,
        message: bindMessage || adminCheck.message
      }
    }

    const adminUser = normalizeUser(user)

    return {
      success: true,
      message: '管理员校验成功',
      data: {
        user: adminUser,
        permissions: adminUser.permissions
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
