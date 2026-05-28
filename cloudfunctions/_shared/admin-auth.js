const tcb = require('@cloudbase/node-sdk')
const { failure } = require('./response')

const DEFAULT_ENV_ID = 'zhi-li-kong-ma-7gy2aqcr1add21a7'

const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || DEFAULT_ENV_ID
})
const auth = app.auth()

function hasRole(user = {}, role) {
  return Array.isArray(user.roles) && user.roles.includes(role)
}

async function getCallerUid() {
  const identity = auth.getUserInfo() || {}
  return identity.uid || identity.user_id || identity.sub || ''
}

async function verifyAdmin(db, options = {}) {
  const uid = await getCallerUid()
  if (!uid) {
    return failure('请先登录', 401)
  }

  const userCollection = options.userCollection || 'users'
  const res = await db.collection(userCollection)
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

module.exports = {
  verifyAdmin,
  hasRole,
  getCallerUid
}
