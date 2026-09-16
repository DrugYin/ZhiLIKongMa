const assert = require('assert')

process.env.TZ = 'UTC'

async function run() {
  const server = require('../cloudfunctions/_shared/subscribe-message')
  const client = require('../miniprogram/services/subscribe-message')
  const notification = require('../cloudfunctions/_shared/notification')

  assert.deepStrictEqual(client.TEMPLATE_IDS, server.TEMPLATE_IDS)
  assert.strictEqual(server.shouldSendTaskPublishedMessage({ taskType: 'class', status: 'published' }), true)
  assert.strictEqual(server.shouldSendTaskPublishedMessage({ taskType: 'public', status: 'published' }), false)
  assert.strictEqual(server.shouldSendTaskPublishedMessage({ taskType: 'class', status: 'draft' }), false)
  assert.strictEqual(server.shouldSendTaskPublishedMessage({ taskType: 'class', status: 'published', previousStatus: 'draft' }), true)
  assert.strictEqual(server.shouldSendTaskPublishedMessage({ taskType: 'class', status: 'published', previousStatus: 'published' }), false)

  const submitMessage = server.buildTaskSubmittedMessage({
    teacherOpenid: 'teacher-openid',
    submissionId: 'submission-1',
    taskTitle: ' 第一行\n第二行而且标题非常非常非常长需要截断 ',
    className: '三年级一班',
    studentName: '张同学名字非常非常长',
    submitTime: new Date('2026-09-10T08:05:00.000Z')
  })
  assert.deepStrictEqual(submitMessage, {
    touser: 'teacher-openid',
    templateId: 'HO4rLQjLFnID1yBejQB7v-zm2QIRbNIlFci5EeMvmnI',
    page: 'pages/teacher/pending/pending?type=submission&record_id=submission-1',
    data: {
      thing9: { value: '第一行 第二行而且标题非常非常非常长需要' },
      thing11: { value: '三年级一班' },
      name1: { value: '张同学名字非常非常长' },
      phrase17: { value: '待审核' },
      time15: { value: '2026年9月10日 16:05' }
    }
  })

  const publishedMessage = server.buildTaskPublishedMessage({
    studentOpenid: 'student-openid',
    taskId: 'task-1',
    taskTitle: '每周算法训练',
    projectName: '',
    projectCode: 'CSP-J',
    teacherName: '王老师',
    publishTime: new Date('2026-09-11T00:30:00.000Z')
  })
  assert.deepStrictEqual(publishedMessage, {
    touser: 'student-openid',
    templateId: '-YZw9XHRKIlte5uQ20dO4lRuaXGFI4gPM_2Z_isBpbo',
    page: 'pages/student/task-manage/task-detail/task-detail?task_id=task-1',
    data: {
      thing15: { value: '每周算法训练' },
      thing5: { value: 'CSP-J' },
      thing22: { value: '王老师' },
      date14: { value: '2026年9月11日' },
      phrase24: { value: '待提交' }
    }
  })

  const reviewedMessage = server.buildSubmissionReviewedMessage({
    studentOpenid: 'student-openid',
    taskId: 'task-1',
    taskTitle: '树与图',
    teacherName: '李老师',
    status: 'rejected',
    feedback: '',
    reviewTime: new Date('2026-09-12T01:07:00.000Z')
  })
  assert.deepStrictEqual(reviewedMessage, {
    touser: 'student-openid',
    templateId: 'WToHJbW9SD8z86AlvCQMMkigfpzIL4AtWtMhVd7gr7w',
    page: 'pages/student/task-manage/submission-records/submission-records?task_id=task-1',
    data: {
      thing2: { value: '树与图' },
      name5: { value: '李老师' },
      thing3: { value: '审核结果：拒绝' },
      thing8: { value: '审核未通过，请修改后重新提交' },
      time1: { value: '2026年9月12日 09:07' }
    }
  })

  const approvedMessage = server.buildSubmissionReviewedMessage({
    studentOpenid: 'student-openid',
    taskId: 'task-2',
    taskTitle: '动态规划',
    teacherName: '陈老师',
    status: 'approved',
    feedback: ' 第一行\n第二行，继续保持这份认真细致的学习状态 ',
    reviewTime: new Date('2026-09-12T02:08:00.000Z')
  })
  assert.strictEqual(approvedMessage.data.thing3.value, '审核结果：通过')
  assert.strictEqual(approvedMessage.data.thing8.value, '第一行 第二行，继续保持这份认真细致的学')
  assert.strictEqual(approvedMessage.data.time1.value, '2026年9月12日 10:08')

  const unavailable = await client.requestSubscribeMessages(
    [client.TEMPLATE_IDS.TASK_SUBMITTED],
    {}
  )
  assert.deepStrictEqual(unavailable, {
    success: false,
    unavailable: true,
    accepted: [],
    rejected: [],
    statuses: {}
  })

  const requestedIds = []
  const subscriptionResult = await client.requestStudentTaskNotifications({
    requestSubscribeMessage(options) {
      requestedIds.push(...options.tmplIds)
      options.success({
        errMsg: 'requestSubscribeMessage:ok',
        [options.tmplIds[0]]: 'accept',
        [options.tmplIds[1]]: 'reject'
      })
    }
  })
  assert.deepStrictEqual(requestedIds, [
    client.TEMPLATE_IDS.TASK_PUBLISHED,
    client.TEMPLATE_IDS.SUBMISSION_REVIEWED
  ])
  assert.deepStrictEqual(subscriptionResult.accepted, [client.TEMPLATE_IDS.TASK_PUBLISHED])
  assert.deepStrictEqual(subscriptionResult.rejected, [client.TEMPLATE_IDS.SUBMISSION_REVIEWED])

  const invalidTemplateResult = await client.requestTeacherSubmissionReminder({
    requestSubscribeMessage(options) {
      options.fail({
        errCode: 20001,
        errMsg: 'requestSubscribeMessage:fail No template data return, verify the template id exist'
      })
    }
  })
  assert.deepStrictEqual(invalidTemplateResult, {
    success: false,
    unavailable: false,
    accepted: [],
    rejected: [],
    statuses: {},
    errorCode: 20001,
    errorMessage: 'requestSubscribeMessage:fail No template data return, verify the template id exist'
  })

  const calls = []
  const fakeCloud = {
    openapi: {
      subscribeMessage: {
        async send(payload) {
          calls.push(payload)
          if (payload.touser === 'student-2') {
            const error = new Error('user refuse to accept the msg')
            error.errCode = 43101
            throw error
          }
          return { errCode: 0, errMsg: 'openapi.subscribeMessage.send:ok' }
        }
      }
    }
  }
  const batchResult = await server.safeSendSubscribeMessages(fakeCloud, [
    { touser: 'student-1', templateId: 'template', page: 'pages/student/index', data: {} },
    { touser: 'student-2', templateId: 'template', page: 'pages/student/index', data: {} },
    { touser: 'student-1', templateId: 'template', page: 'pages/student/index', data: {} }
  ], {
    batchSize: 2,
    contextLabel: 'test',
    logger: { error() {} }
  })
  assert.deepStrictEqual(calls.map((item) => item.touser), ['student-1', 'student-2'])
  assert.strictEqual(calls[0].miniprogramState, 'formal')
  assert.strictEqual(calls[0].lang, 'zh_CN')
  assert.deepStrictEqual(batchResult, {
    total: 2,
    sent: 1,
    failed: 1,
    skipped: 1
  })

  const subscribeLogs = []
  const logDb = {
    collection(name) {
      assert.strictEqual(name, 'subscribe_message_logs')
      return {
        async add(payload) {
          subscribeLogs.push(payload.data)
          return { _id: `log-${subscribeLogs.length}` }
        }
      }
    }
  }
  const loggedResult = await server.safeSendSubscribeMessage(fakeCloud, {
    touser: 'student-1',
    templateId: 'template',
    page: 'pages/student/index',
    data: {}
  }, {
    db: logDb,
    now: new Date('2026-09-16T01:02:03.000Z'),
    logContext: {
      messageType: 'task_published',
      sourceFunction: 'create-task',
      taskId: 'task-1',
      classId: 'class-1'
    },
    logger: { error() {} }
  })
  assert.strictEqual(loggedResult.success, true)
  assert.strictEqual(subscribeLogs.length, 1)
  assert.strictEqual(subscribeLogs[0].status, 'success')
  assert.strictEqual(subscribeLogs[0].message_type, 'task_published')
  assert.strictEqual(subscribeLogs[0].recipient_openid, 'student-1')
  assert.strictEqual(subscribeLogs[0].task_id, 'task-1')
  assert.strictEqual(subscribeLogs[0].miniprogram_state, 'formal')
  assert.strictEqual(subscribeLogs[0].expire_time.toISOString(), '2027-09-16T01:02:03.000Z')

  await server.safeSendSubscribeMessage(fakeCloud, {
    touser: 'student-2',
    templateId: 'template',
    page: 'pages/student/index',
    data: {}
  }, {
    db: logDb,
    now: new Date('2026-09-16T01:02:03.000Z'),
    logContext: {
      messageType: 'submission_reviewed',
      sourceFunction: 'review-submission',
      submissionId: 'submission-1'
    },
    logger: { error() {} }
  })
  assert.strictEqual(subscribeLogs[1].status, 'failed')
  assert.strictEqual(subscribeLogs[1].error_code, 43101)
  assert.strictEqual(subscribeLogs[1].submission_id, 'submission-1')

  const rows = {
    class_memberships: [
      { student_openid: 'student-1' },
      { student_openid: 'student-2' }
    ],
    users: [
      { _openid: 'student-2' },
      { _openid: 'student-3' }
    ]
  }
  const fakeDb = {
    command: { neq(value) { return { neq: value } } },
    collection(name) {
      let skip = 0
      let limit = 100
      const query = {
        where() { return query },
        field() { return query },
        async count() { return { total: rows[name].length } },
        skip(value) { skip = value; return query },
        limit(value) { limit = value; return query },
        async get() { return { data: rows[name].slice(skip, skip + limit) } }
      }
      return query
    }
  }
  assert.deepStrictEqual(
    await notification.getClassStudentOpenids(fakeDb, 'class-1'),
    ['student-1', 'student-2', 'student-3']
  )
  assert.deepStrictEqual(await notification.getClassStudentOpenids(fakeDb, ''), [])
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
