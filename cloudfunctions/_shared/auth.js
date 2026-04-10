async function getCurrentUser(db, openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return res.data[0] || null
}

async function verifyTeacherRole(db, openid) {
  const user = await getCurrentUser(db, openid)
  return user && Array.isArray(user.roles) && user.roles.includes('teacher') ? user : null
}

module.exports = {
  getCurrentUser,
  verifyTeacherRole
}
