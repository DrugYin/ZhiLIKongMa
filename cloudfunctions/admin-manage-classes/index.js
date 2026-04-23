/**
 * 后台班级管理云函数
 * 功能：对 classes、class_memberships、class_join_applications 提供管理员管理能力
 */

const cloud = require('wx-server-sdk')
const tcb = require('@cloudbase/node-sdk')
const { writeAdminOperationLog } = require('/opt/admin-operation-log')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCB_ENV || process.env.CLOUDBASE_ENV || 'zhi-li-kong-ma-7gy2aqcr1add21a7'
})
const auth = app.auth()

const CLASS_COLLECTION = 'classes'
const MEMBERSHIP_COLLECTION = 'class_memberships'
const APPLICATION_COLLECTION = 'class_join_applications'
const USER_COLLECTION = 'users'
const PAGE_SIZE = 100
const VALID_STATUS = ['active', 'inactive', 'deleted']
const CLASS_CODE_PATTERN = /^[A-Z0-9]{4,12}$/

function success(message, data = {}) {
  return {
    success: true,
    message,
    data
  }
}

function failure(message, errorCode, extra = {}) {
  return {
    success: false,
    message,
    error_code: errorCode,
    ...extra
  }
}

function hasRole(user, role) {
  return Array.isArray(user.roles) && user.roles.includes(role)
}

async function getCallerUid() {
  const identity = auth.getUserInfo() || {}
  return identity.uid || identity.user_id || identity.sub || ''
}

async function verifyAdmin() {
  const uid = await getCallerUid()
  if (!uid) {
    return failure('请先登录', 401)
  }

  const res = await db.collection(USER_COLLECTION)
    .where({
      admin_auth_uid: uid
    })
    .limit(1)
    .get()
  const user = res.data[0]

  if (!user || !hasRole(user, 'admin')) {
    return failure('当前账号没有后台管理员权限', 403)
  }

  if (user.status === 'disabled' || user.admin_status === 'disabled') {
    return failure('当前管理员账号已被禁用', 403)
  }

  return {
    success: true,
    uid,
    user
  }
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeNumber(value, fallback = 0) {
  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? fallback : numberValue
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

function normalizeStatus(value, fallback = 'active') {
  const status = normalizeString(value)
  return VALID_STATUS.includes(status) ? status : fallback
}

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function getClassByCode(classCode) {
  const res = await db.collection(CLASS_COLLECTION)
    .where({
      class_code: classCode
    })
    .limit(2)
    .get()

  if (res.data.length > 1) {
    throw new Error(`班级邀请码 ${classCode} 存在重复记录，请先清理数据`)
  }

  return res.data[0] || null
}

async function createUniqueClassCode(inputCode = '') {
  const normalizedInput = normalizeString(inputCode).toUpperCase()
  if (normalizedInput) {
    if (!CLASS_CODE_PATTERN.test(normalizedInput)) {
      throw new Error('班级邀请码仅支持 4-12 位大写字母或数字')
    }

    const existing = await getClassByCode(normalizedInput)
    if (existing) {
      throw new Error('班级邀请码已存在，请更换')
    }

    return normalizedInput
  }

  for (let index = 0; index < 10; index += 1) {
    const classCode = generateClassCode()
    const existing = await getClassByCode(classCode)
    if (!existing) {
      return classCode
    }
  }

  throw new Error('班级邀请码生成失败，请重试')
}

async function getClassById(id) {
  if (!id) {
    return null
  }

  try {
    const res = await db.collection(CLASS_COLLECTION).doc(id).get()
    return res.data || null
  } catch (error) {
    return null
  }
}

async function fetchAll(collectionName, queryData = {}, fields = {}) {
  const query = Object.keys(queryData).length
    ? db.collection(collectionName).where(queryData)
    : db.collection(collectionName)
  const totalRes = await query.count()
  const total = totalRes.total || 0
  const tasks = []

  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    let pageQuery = query.skip(skip).limit(PAGE_SIZE)
    if (Object.keys(fields).length) {
      pageQuery = pageQuery.field(fields)
    }
    tasks.push(pageQuery.get())
  }

  if (!tasks.length) {
    return []
  }

  const pages = await Promise.all(tasks)
  return pages.reduce((result, item) => result.concat(item.data || []), [])
}

async function getTeacherByOpenid(openid) {
  if (!openid) {
    return null
  }

  const res = await db.collection(USER_COLLECTION)
    .where({
      _openid: openid
    })
    .limit(1)
    .get()
  const user = res.data[0]

  return user && hasRole(user, 'teacher') ? user : null
}

function getTeacherName(teacher = {}) {
  return teacher.user_name || teacher.nick_name || teacher.nickname || ''
}

async function getProjectByCode(projectCode) {
  if (!projectCode) {
    return null
  }

  const res = await db.collection('projects')
    .where({
      project_code: projectCode
    })
    .limit(1)
    .get()

  return res.data[0] || null
}

function normalizeClassDoc(doc = {}) {
  return {
    ...doc,
    class_name: doc.class_name || '',
    class_code: doc.class_code || '',
    teacher_openid: doc.teacher_openid || '',
    teacher_name: doc.teacher_name || '',
    project_code: doc.project_code || '',
    project_name: doc.project_name || '',
    class_time: doc.class_time || '',
    location: doc.location || '',
    description: doc.description || '',
    max_members: normalizeNumber(doc.max_members, 50),
    member_count: normalizeNumber(doc.member_count, 0),
    status: normalizeStatus(doc.status, 'active')
  }
}

function matchKeyword(item, keyword) {
  if (!keyword) {
    return true
  }

  const searchText = [
    item.class_name,
    item.class_code,
    item.teacher_name,
    item.project_name,
    item.project_code,
    item.location,
    item.description
  ].join(' ').toLowerCase()

  return searchText.includes(keyword.toLowerCase())
}

async function countClassMembers(classId) {
  const [memberships, legacyMembers] = await Promise.all([
    fetchAll(MEMBERSHIP_COLLECTION, { class_id: classId }, { student_openid: true }),
    fetchAll(USER_COLLECTION, { class_id: classId }, { _openid: true })
  ])

  return Array.from(new Set(
    memberships.map((item) => item.student_openid).concat(legacyMembers.map((item) => item._openid)).filter(Boolean)
  )).length
}

async function enrichClass(doc) {
  const item = normalizeClassDoc(doc)
  const [memberCount, pendingCount, applicationCount, taskCount] = await Promise.all([
    countClassMembers(item._id),
    db.collection(APPLICATION_COLLECTION).where({ class_id: item._id, status: 'pending' }).count(),
    db.collection(APPLICATION_COLLECTION).where({ class_id: item._id }).count(),
    db.collection('tasks').where({ class_id: item._id, is_deleted: _.neq(true) }).count()
  ])

  return {
    ...item,
    member_count: memberCount,
    pending_application_count: pendingCount.total || 0,
    application_count: applicationCount.total || 0,
    task_count: taskCount.total || 0
  }
}

async function listClasses(event = {}) {
  const keyword = normalizeString(event.keyword)
  const projectCode = normalizeString(event.project_code)
  const status = normalizeString(event.status)
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const allClasses = await fetchAll(CLASS_COLLECTION)

  const filtered = allClasses
    .map(normalizeClassDoc)
    .filter((item) => (status ? item.status === status : item.status !== 'deleted'))
    .filter((item) => !projectCode || item.project_code === projectCode)
    .filter((item) => matchKeyword(item, keyword))
    .sort((a, b) => {
      const aTime = new Date(a.update_time || a.create_time || 0).getTime()
      const bTime = new Date(b.update_time || b.create_time || 0).getTime()
      return bTime - aTime
    })

  const start = (page - 1) * pageSize
  const pageList = filtered.slice(start, start + pageSize)
  const list = await Promise.all(pageList.map(enrichClass))

  return success('获取班级列表成功', {
    list,
    total: filtered.length,
    page,
    page_size: pageSize
  })
}

async function getClass(event = {}) {
  const classId = normalizeString(event._id || event.class_id || event.id)
  const classInfo = await getClassById(classId)

  if (!classInfo || classInfo.status === 'deleted') {
    return failure('班级不存在', 404)
  }

  return success('获取班级详情成功', {
    class_info: await enrichClass(classInfo)
  })
}

async function normalizeClassPayload(payload = {}, current = null) {
  const className = normalizeString(payload.class_name)
  const teacherOpenid = normalizeString(payload.teacher_openid)
  const projectCode = normalizeString(payload.project_code)
  const maxMembers = normalizeNumber(payload.max_members, 50)
  const status = normalizeStatus(payload.status, current?.status || 'active')

  if (!className) {
    throw new Error('班级名称不能为空')
  }

  if (!teacherOpenid) {
    throw new Error('请选择班级教师')
  }

  if (!projectCode) {
    throw new Error('请选择所属项目')
  }

  if (!Number.isInteger(maxMembers) || maxMembers <= 0) {
    throw new Error('班级人数上限必须是正整数')
  }

  const [teacher, project] = await Promise.all([
    getTeacherByOpenid(teacherOpenid),
    getProjectByCode(projectCode)
  ])

  if (!teacher) {
    throw new Error('所选教师不存在或不是教师角色')
  }

  if (!project) {
    throw new Error('所选项目不存在')
  }

  return {
    class_name: className,
    teacher_openid: teacherOpenid,
    teacher_name: getTeacherName(teacher),
    project_code: projectCode,
    project_name: project.project_name || normalizeString(payload.project_name),
    class_time: normalizeString(payload.class_time),
    location: normalizeString(payload.location),
    description: normalizeString(payload.description),
    max_members: maxMembers,
    status
  }
}

async function createClass(event = {}, admin) {
  const now = new Date()
  const input = event.class_info || event.class || event
  const payload = await normalizeClassPayload(input)
  const classCode = await createUniqueClassCode(input.class_code)

  const addRes = await db.collection(CLASS_COLLECTION).add({
    data: {
      ...payload,
      class_code: classCode,
      member_count: 0,
      create_time: now,
      update_time: now,
      created_by: admin.user._id,
      updated_by: admin.user._id
    }
  })

  const classInfo = {
    _id: addRes._id,
    ...payload,
    class_code: classCode,
    member_count: 0,
    create_time: now,
    update_time: now
  }
  await writeOperationLog('create', classInfo, admin)

  return success('创建班级成功', {
    class_info: classInfo
  })
}

async function updateClass(event = {}, admin) {
  const now = new Date()
  const input = event.class_info || event.class || event
  const classId = normalizeString(input._id || input.class_id || input.id)
  const current = await getClassById(classId)

  if (!current || current.status === 'deleted') {
    return failure('班级不存在，无法更新', 404)
  }

  const payload = await normalizeClassPayload(input, current)
  const actualMemberCount = await countClassMembers(current._id)
  if (payload.max_members < actualMemberCount) {
    return failure('人数上限不能小于当前成员人数', 409, {
      member_count: actualMemberCount
    })
  }

  await db.collection(CLASS_COLLECTION).doc(current._id).update({
    data: {
      ...payload,
      member_count: actualMemberCount,
      update_time: now,
      updated_by: admin.user._id
    }
  })

  await syncClassDenormalizedFields(current._id, {
    class_name: payload.class_name,
    class_code: current.class_code
  }, now)

  const classInfo = {
    ...current,
    ...payload,
    member_count: actualMemberCount,
    update_time: now
  }
  await writeOperationLog('update', classInfo, admin, current)

  return success('更新班级成功', {
    class_info: classInfo
  })
}

async function syncClassDenormalizedFields(classId, classInfo, now) {
  const [legacyMembers, applications] = await Promise.all([
    fetchAll(USER_COLLECTION, { class_id: classId }, { _id: true }),
    fetchAll(APPLICATION_COLLECTION, { class_id: classId }, { _id: true })
  ])

  await Promise.all(legacyMembers.map((member) => db.collection(USER_COLLECTION).doc(member._id).update({
    data: {
      class_name: classInfo.class_name,
      class_code: classInfo.class_code,
      update_time: now
    }
  })))

  await Promise.all(applications.map((application) => db.collection(APPLICATION_COLLECTION).doc(application._id).update({
    data: {
      class_name: classInfo.class_name,
      class_code: classInfo.class_code,
      update_time: now
    }
  })))
}

async function deleteClass(event = {}, admin) {
  const now = new Date()
  const classId = normalizeString(event._id || event.class_id || event.id)
  const current = await getClassById(classId)

  if (!current || current.status === 'deleted') {
    return failure('班级不存在或已删除', 404)
  }

  const [legacyMembers, memberships] = await Promise.all([
    fetchAll(USER_COLLECTION, { class_id: current._id }, { _id: true, _openid: true }),
    fetchAll(MEMBERSHIP_COLLECTION, { class_id: current._id }, { _id: true, student_openid: true })
  ])

  await Promise.all(legacyMembers.map((member) => db.collection(USER_COLLECTION).doc(member._id).update({
    data: {
      class_id: _.remove(),
      class_name: _.remove(),
      class_code: _.remove(),
      join_class_time: _.remove(),
      update_time: now
    }
  })))

  await Promise.all(memberships.map((membership) => (
    db.collection(MEMBERSHIP_COLLECTION).doc(membership._id).remove()
  )))

  const pendingApplications = await fetchAll(APPLICATION_COLLECTION, {
    class_id: current._id,
    status: 'pending'
  }, { _id: true })

  await Promise.all(pendingApplications.map((application) => db.collection(APPLICATION_COLLECTION).doc(application._id).update({
    data: {
      status: 'rejected',
      review_remark: '班级已由后台删除',
      review_by: admin.user._id,
      review_time: now,
      update_time: now
    }
  })))

  await db.collection(CLASS_COLLECTION).doc(current._id).update({
    data: {
      status: 'deleted',
      member_count: 0,
      update_time: now,
      delete_time: now,
      deleted_by: admin.user._id
    }
  })

  await writeOperationLog('delete', current, admin, current)

  return success('删除班级成功', {
    class_id: current._id,
    removed_member_count: Array.from(new Set(
      legacyMembers.map((item) => item._openid).concat(memberships.map((item) => item.student_openid)).filter(Boolean)
    )).length
  })
}

async function listMembers(event = {}) {
  const classId = normalizeString(event._id || event.class_id || event.id)
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const classInfo = await getClassById(classId)

  if (!classInfo || classInfo.status === 'deleted') {
    return failure('班级不存在', 404)
  }

  const [membershipDocs, legacyMembers] = await Promise.all([
    fetchAll(MEMBERSHIP_COLLECTION, { class_id: classId }, {
      _id: true,
      student_openid: true,
      join_class_time: true
    }),
    fetchAll(USER_COLLECTION, { class_id: classId }, {
      _id: true,
      _openid: true,
      user_name: true,
      nick_name: true,
      avatar_url: true,
      grade: true,
      phone: true,
      join_class_time: true,
      points: true,
      total_points: true
    })
  ])
  const memberMap = legacyMembers.reduce((result, item) => {
    if (item._openid) {
      result[item._openid] = {
        ...item,
        member_openid: item._openid,
        membership_id: '',
        join_class_time: item.join_class_time || null,
        source: 'legacy'
      }
    }
    return result
  }, {})
  const missingOpenids = membershipDocs
    .map((item) => item.student_openid)
    .filter((openid) => openid && !memberMap[openid])

  if (missingOpenids.length) {
    const users = await getUsersByOpenids(missingOpenids)
    users.forEach((user) => {
      memberMap[user._openid] = {
        ...user,
        member_openid: user._openid,
        membership_id: '',
        join_class_time: null,
        source: 'membership'
      }
    })
  }

  membershipDocs.forEach((membership) => {
    if (!membership.student_openid) {
      return
    }

    const current = memberMap[membership.student_openid] || {
      member_openid: membership.student_openid
    }
    memberMap[membership.student_openid] = {
      ...current,
      membership_id: membership._id,
      join_class_time: membership.join_class_time || current.join_class_time || null,
      source: current.source === 'legacy' ? 'both' : 'membership'
    }
  })

  const list = Object.values(memberMap).sort((left, right) => {
    const leftTime = new Date(left.join_class_time || 0).getTime()
    const rightTime = new Date(right.join_class_time || 0).getTime()
    return rightTime - leftTime
  })
  const start = (page - 1) * pageSize

  return success('获取班级成员成功', {
    list: list.slice(start, start + pageSize),
    total: list.length,
    page,
    page_size: pageSize
  })
}

async function getUsersByOpenids(openids = []) {
  if (!openids.length) {
    return []
  }

  const list = []
  for (let index = 0; index < openids.length; index += PAGE_SIZE) {
    const chunk = openids.slice(index, index + PAGE_SIZE)
    const res = await db.collection(USER_COLLECTION).where({
      _openid: _.in(chunk)
    }).field({
      _id: true,
      _openid: true,
      user_name: true,
      nick_name: true,
      avatar_url: true,
      grade: true,
      phone: true,
      points: true,
      total_points: true
    }).get()
    list.push(...(res.data || []))
  }

  return list
}

async function removeMember(event = {}, admin) {
  const now = new Date()
  const classId = normalizeString(event.class_id)
  const memberOpenid = normalizeString(event.member_openid)
  const classInfo = await getClassById(classId)

  if (!classInfo || classInfo.status === 'deleted') {
    return failure('班级不存在', 404)
  }

  if (!memberOpenid) {
    return failure('缺少成员 OpenID', 400)
  }

  const [membershipRes, memberRes] = await Promise.all([
    db.collection(MEMBERSHIP_COLLECTION).where({
      class_id: classId,
      student_openid: memberOpenid
    }).limit(1).get(),
    db.collection(USER_COLLECTION).where({
      _openid: memberOpenid
    }).limit(1).get()
  ])
  const membership = membershipRes.data[0]
  const member = memberRes.data[0]
  const isLegacyMember = Boolean(member && member.class_id === classId)

  if (!membership && !isLegacyMember) {
    return failure('成员不存在或不在该班级中', 404)
  }

  const tasks = []
  if (membership) {
    tasks.push(db.collection(MEMBERSHIP_COLLECTION).doc(membership._id).remove())
  }

  if (isLegacyMember) {
    tasks.push(db.collection(USER_COLLECTION).doc(member._id).update({
      data: {
        class_id: _.remove(),
        class_name: _.remove(),
        class_code: _.remove(),
        join_class_time: _.remove(),
        update_time: now
      }
    }))
  } else if (member && member._id) {
    tasks.push(db.collection(USER_COLLECTION).doc(member._id).update({
      data: {
        update_time: now
      }
    }))
  }

  await Promise.all(tasks)
  const memberCount = await countClassMembers(classId)
  await db.collection(CLASS_COLLECTION).doc(classId).update({
    data: {
      member_count: memberCount,
      update_time: now
    }
  })

  await writeOperationLog('remove_member', {
    ...classInfo,
    member_openid: memberOpenid,
    member_name: member ? (member.user_name || member.nick_name || '') : ''
  }, admin, classInfo)

  return success('移除成员成功', {
    class_id: classId,
    member_openid: memberOpenid,
    member_count: memberCount
  })
}

async function listApplications(event = {}) {
  const classId = normalizeString(event.class_id)
  const status = normalizeString(event.status || 'all')
  const page = normalizePage(event.page)
  const pageSize = normalizePageSize(event.page_size || event.pageSize)
  const queryData = {
    class_id: classId
  }

  if (!classId) {
    return failure('缺少班级ID', 400)
  }

  if (['pending', 'approved', 'rejected'].includes(status)) {
    queryData.status = status
  }

  const allApplications = await fetchAll(APPLICATION_COLLECTION, queryData)
  const sorted = allApplications.sort((left, right) => {
    const leftTime = new Date(left.create_time || 0).getTime()
    const rightTime = new Date(right.create_time || 0).getTime()
    return rightTime - leftTime
  })
  const start = (page - 1) * pageSize

  return success('获取入班申请成功', {
    list: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page,
    page_size: pageSize
  })
}

async function reviewApplication(event = {}, admin) {
  const applicationId = normalizeString(event.application_id)
  const action = normalizeString(event.review_action || event.reviewAction || event.action_type)
  const reviewRemark = normalizeString(event.review_remark)

  if (!applicationId || !['approve', 'reject'].includes(action)) {
    return failure('审批参数不合法', 400)
  }

  const applicationRes = await db.collection(APPLICATION_COLLECTION).doc(applicationId).get()
  const application = applicationRes.data || null
  if (!application) {
    return failure('申请记录不存在', 404)
  }

  if (application.status !== 'pending') {
    return failure('该申请已处理，请勿重复操作', 409)
  }

  const classInfo = await getClassById(application.class_id)
  if (!classInfo || classInfo.status !== 'active') {
    return failure('班级不存在或已停用', 404)
  }

  const studentRes = await db.collection(USER_COLLECTION).where({
    _openid: application.student_openid
  }).limit(1).get()
  const student = studentRes.data[0]
  if (!student) {
    return failure('申请学生不存在', 404)
  }

  const membershipRes = await db.collection(MEMBERSHIP_COLLECTION).where({
    class_id: classInfo._id,
    student_openid: application.student_openid
  }).limit(1).get()
  const alreadyJoined = Boolean(membershipRes.data[0] || student.class_id === classInfo._id)

  if (action === 'approve' && !alreadyJoined) {
    const memberCount = await countClassMembers(classInfo._id)
    if (memberCount >= Number(classInfo.max_members || 0)) {
      return failure('班级人数已满，无法通过申请', 409)
    }
  }

  const now = new Date()
  await db.collection(APPLICATION_COLLECTION).doc(applicationId).update({
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      review_remark: reviewRemark,
      review_by: admin.user._id,
      review_time: now,
      update_time: now
    }
  })

  if (action === 'approve' && !alreadyJoined) {
    await db.collection(MEMBERSHIP_COLLECTION).add({
      data: {
        class_id: classInfo._id,
        student_openid: application.student_openid,
        source_application_id: applicationId,
        join_class_time: now,
        create_time: now,
        update_time: now
      }
    })

    const memberCount = await countClassMembers(classInfo._id)
    await db.collection(CLASS_COLLECTION).doc(classInfo._id).update({
      data: {
        member_count: memberCount,
        update_time: now
      }
    })
  }

  await writeOperationLog(action === 'approve' ? 'approve_application' : 'reject_application', {
    ...classInfo,
    application_id: applicationId,
    student_openid: application.student_openid
  }, admin, classInfo)

  return success(action === 'approve' ? '通过申请成功' : '拒绝申请成功', {
    application_id: applicationId,
    class_id: classInfo._id,
    status: action === 'approve' ? 'approved' : 'rejected'
  })
}

async function writeOperationLog(action, classInfo, admin, beforeClass = null) {
  const detail = {
    class_name: classInfo.class_name,
    class_code: classInfo.class_code,
    project_code: classInfo.project_code,
    teacher_openid: classInfo.teacher_openid,
    status: classInfo.status
  }

  if (beforeClass) {
    detail.before = {
      class_name: beforeClass.class_name,
      project_code: beforeClass.project_code,
      teacher_openid: beforeClass.teacher_openid,
      max_members: beforeClass.max_members,
      status: beforeClass.status
    }
  }

  if (action !== 'delete') {
    detail.after = {
      class_name: classInfo.class_name,
      project_code: classInfo.project_code,
      teacher_openid: classInfo.teacher_openid,
      max_members: classInfo.max_members,
      status: classInfo.status,
      member_openid: classInfo.member_openid,
      application_id: classInfo.application_id
    }
  }

  await writeAdminOperationLog(db, {
    module: 'classes',
    action,
    targetId: classInfo._id,
    targetKey: classInfo.class_code || classInfo._id,
    admin,
    detail,
    contextLabel: 'admin-manage-classes'
  })
}

exports.main = async (event = {}) => {
  try {
    const adminCheck = await verifyAdmin()
    if (!adminCheck.success) {
      return adminCheck
    }

    const action = normalizeString(event.action || 'list')
    if (action === 'list') {
      return listClasses(event)
    }

    if (action === 'get') {
      return getClass(event)
    }

    if (action === 'create') {
      return createClass(event, adminCheck)
    }

    if (action === 'update') {
      return updateClass(event, adminCheck)
    }

    if (action === 'delete') {
      return deleteClass(event, adminCheck)
    }

    if (action === 'members') {
      return listMembers(event)
    }

    if (action === 'remove_member') {
      return removeMember(event, adminCheck)
    }

    if (action === 'applications') {
      return listApplications(event)
    }

    if (action === 'review_application') {
      return reviewApplication(event, adminCheck)
    }

    return failure('不支持的班级操作', 400)
  } catch (error) {
    console.error('[admin-manage-classes] Error:', error)
    return failure(error.message || '班级操作失败', 500)
  }
}
