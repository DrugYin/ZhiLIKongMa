const DEFAULT_PAGE_SIZE = 100
const DEFAULT_BATCH_SIZE = 20

function chunkList(list = [], chunkSize = DEFAULT_BATCH_SIZE) {
  const result = []

  for (let index = 0; index < list.length; index += chunkSize) {
    result.push(list.slice(index, index + chunkSize))
  }

  return result
}

async function getAllMembershipsByStudent(db, openid, fieldConfig = {
  _id: true,
  class_id: true,
  join_class_time: true
}, pageSize = DEFAULT_PAGE_SIZE) {
  const totalRes = await db.collection('class_memberships').where({
    student_openid: openid
  }).count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += pageSize) {
    tasks.push(
      db.collection('class_memberships').where({
        student_openid: openid
      }).skip(skip).limit(pageSize).field(fieldConfig).get()
    )
  }

  if (!tasks.length) {
    return []
  }

  const list = await Promise.all(tasks)
  return list.reduce((result, item) => result.concat(item.data || []), [])
}

function buildJoinedClassIds(user, memberships = []) {
  const joinedClassIds = memberships.map((item) => item.class_id).filter(Boolean)

  if (user && user.class_id && !joinedClassIds.includes(user.class_id)) {
    joinedClassIds.push(user.class_id)
  }

  return joinedClassIds
}

async function getClassesByIds(db, command, classIds = [], batchSize = DEFAULT_BATCH_SIZE) {
  const tasks = chunkList(classIds, batchSize).map((batchIds) => (
    db.collection('classes').where({
      _id: command.in(batchIds)
    }).get()
  ))

  if (!tasks.length) {
    return []
  }

  const list = await Promise.all(tasks)
  return list.reduce((result, item) => result.concat(item.data || []), [])
}

module.exports = {
  chunkList,
  getAllMembershipsByStudent,
  buildJoinedClassIds,
  getClassesByIds
}
