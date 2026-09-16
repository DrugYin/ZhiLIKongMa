const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const COLLECTION = 'subscribe_message_logs'
const BATCH_SIZE = 100
const MAX_DELETE = 1000

exports.main = async () => {
  const now = new Date()
  let deleted = 0

  while (deleted < MAX_DELETE) {
    const result = await db.collection(COLLECTION)
      .where({ expire_time: _.lte(now) })
      .field({ _id: true })
      .limit(Math.min(BATCH_SIZE, MAX_DELETE - deleted))
      .get()
    const rows = result.data || []
    if (!rows.length) break
    await Promise.all(rows.map((row) => db.collection(COLLECTION).doc(row._id).remove()))
    deleted += rows.length
    if (rows.length < BATCH_SIZE) break
  }

  return { success: true, deleted, has_more: deleted >= MAX_DELETE, run_time: now }
}
