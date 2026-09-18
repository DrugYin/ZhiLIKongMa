const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const projectRoot = path.resolve(__dirname, '..')

function loadCloudFunctionInternals(relativePath, names) {
  const filePath = path.join(projectRoot, relativePath)
  const source = fs.readFileSync(filePath, 'utf8')
  const exportedEntries = names.map((name) => (
    `${JSON.stringify(name)}: typeof ${name} === 'function' ? ${name} : null`
  ))
  const db = {
    command: {},
    collection() {
      return {}
    }
  }
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
    console,
    require(request) {
      if (request === 'wx-server-sdk') {
        return {
          DYNAMIC_CURRENT_ENV: 'test',
          init() {},
          database() {
            return db
          },
          getWXContext() {
            return { OPENID: 'test-openid' }
          }
        }
      }

      if (request === '/opt/utils') {
        return {
          normalizeString(value) {
            return String(value || '').trim()
          }
        }
      }

      if (request.startsWith('/opt/')) {
        return new Proxy({}, {
          get() {
            return () => null
          }
        })
      }

      return require(request)
    }
  }

  vm.runInNewContext(
    `${source}\nmodule.exports.__test = { ${exportedEntries.join(', ')} }`,
    sandbox,
    { filename: filePath }
  )

  return module.exports.__test
}

function loadTaskService(taskApi) {
  const filePath = path.join(projectRoot, 'miniprogram/services/task.js')
  const source = fs.readFileSync(filePath, 'utf8')
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
    require(request) {
      if (request === './api') {
        return { taskApi }
      }
      return require(request)
    }
  }

  vm.runInNewContext(source, sandbox, { filename: filePath })
  return module.exports
}

async function run() {
  const taskInternals = loadCloudFunctionInternals(
    'cloudfunctions/get-tasks/index.js',
    ['normalizeTaskView']
  )
  assert.equal(typeof taskInternals.normalizeTaskView, 'function')
  assert.equal(taskInternals.normalizeTaskView({}), 'detail')
  assert.equal(taskInternals.normalizeTaskView({ view: 'list' }), 'list')

  const submissionInternals = loadCloudFunctionInternals(
    'cloudfunctions/get-submissions/index.js',
    ['normalizeSubmissionView']
  )
  assert.equal(typeof submissionInternals.normalizeSubmissionView, 'function')
  assert.equal(submissionInternals.normalizeSubmissionView({}), 'detail')
  assert.equal(submissionInternals.normalizeSubmissionView({ view: 'list' }), 'list')
  assert.equal(submissionInternals.normalizeSubmissionView({ view: 'task_ids' }), 'task_ids')

  const rankingInternals = loadCloudFunctionInternals(
    'cloudfunctions/get-ranking/index.js',
    ['normalizeRankingPagination', 'buildRankingData']
  )
  assert.equal(typeof rankingInternals.normalizeRankingPagination, 'function')
  const legacyPagination = rankingInternals.normalizeRankingPagination({ rank_type: 'week' })
  assert.equal(legacyPagination.paginated, false)
  const legacyRanking = rankingInternals.buildRankingData({
    rankType: 'week',
    rankingList: [
      { _openid: 'student-1', rank: 1, points: 30 },
      { _openid: 'student-2', rank: 2, points: 20 }
    ],
    participantCount: 2,
    currentOpenid: 'student-1',
    ...legacyPagination
  })
  assert.deepEqual(Array.from(legacyRanking.list, (item) => item._openid), ['student-1', 'student-2'])
  assert.equal(legacyRanking.has_more, false)

  const pagedRanking = rankingInternals.buildRankingData({
    rankType: 'week',
    rankingList: [
      { _openid: 'student-1', rank: 1, points: 30 },
      { _openid: 'student-2', rank: 2, points: 20 }
    ],
    participantCount: 2,
    currentOpenid: 'student-1',
    ...rankingInternals.normalizeRankingPagination({ page: 2, page_size: 1 })
  })
  assert.deepEqual(Array.from(pagedRanking.list, (item) => item._openid), ['student-2'])

  const taskRequests = []
  const submissionRequests = []
  const TaskService = loadTaskService({
    async getTasks(params) {
      taskRequests.push(params)
      return { success: true, data: {} }
    },
    async getSubmissions(params) {
      submissionRequests.push(params)
      return { success: true, data: {} }
    }
  })
  await TaskService.getTasks({ page: 1 })
  await TaskService.getTasks({ task_id: 'task-1', view: 'detail' })
  await TaskService.getSubmissions({ page: 1 })
  await TaskService.getSubmissions({ task_id: 'task-1', view: 'detail' })
  assert.equal(taskRequests[0].view, 'list')
  assert.equal(taskRequests[1].view, 'detail')
  assert.equal(submissionRequests[0].view, 'list')
  assert.equal(submissionRequests[1].view, 'detail')

  const AnnouncementService = require('../miniprogram/services/announcement')
  assert.equal(typeof AnnouncementService.resolveActionUrl, 'function')
  assert.equal(
    AnnouncementService.resolveActionUrl('/pages/student/task-manage/task-detail/task-detail?task_id=task-1'),
    '/subpackages/student/task-manage/task-detail/task-detail?task_id=task-1'
  )
  assert.equal(
    AnnouncementService.resolveActionUrl('/pages/teacher/pending/pending?type=submission'),
    '/pages/teacher/pending/pending?type=submission'
  )

  const notification = require('../cloudfunctions/_shared/notification')
  assert.equal(typeof notification.buildStudentActionUrl, 'function')
  assert.equal(
    notification.buildStudentActionUrl('task_detail', { task_id: 'task-1' }),
    '/pages/student/task-manage/task-detail/task-detail?task_id=task-1'
  )
  assert.equal(
    notification.buildStudentActionUrl('submission_records', { task_id: 'task-1' }),
    '/pages/student/task-manage/submission-records/submission-records?task_id=task-1'
  )
  assert.equal(
    notification.buildStudentActionUrl('class_detail', { class_id: 'class-1' }),
    '/pages/student/class-manage/class-detail/class-detail?class_id=class-1'
  )
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
