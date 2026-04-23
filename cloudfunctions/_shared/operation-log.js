async function writeOperationLog(db, {
  openid,
  userType,
  action,
  targetType,
  targetId,
  detail,
  now,
  contextLabel = 'cloudfunction'
}) {
  try {
    await db.collection('operation_logs').add({
      data: {
        user_openid: openid,
        user_type: userType,
        action,
        target_type: targetType,
        target_id: targetId,
        detail,
        create_time: now
      }
    })
  } catch (error) {
    console.error(`[${contextLabel}] writeOperationLog Error:`, error)
  }
}

module.exports = {
  writeOperationLog
}
