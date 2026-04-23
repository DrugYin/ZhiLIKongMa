async function writeAdminOperationLog(db, {
  module,
  action,
  targetId,
  targetKey,
  admin,
  detail,
  now = new Date(),
  contextLabel = 'admin-cloudfunction'
}) {
  try {
    await db.collection('operation_logs').add({
      data: {
        module,
        action,
        target_id: targetId,
        target_key: targetKey,
        operator_id: admin.user._id,
        operator_name: admin.user.user_name || admin.user.nick_name || '管理员',
        detail,
        create_time: now
      }
    })
  } catch (error) {
    console.warn(`[${contextLabel}] writeOperationLog failed:`, error.message)
  }
}

module.exports = {
  writeAdminOperationLog
}
