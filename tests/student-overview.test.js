const assert = require('assert')
const fs = require('fs')

const source = fs.readFileSync('cloudfunctions/get-student-overview/index.js', 'utf8')
const api = fs.readFileSync('miniprogram/services/api.js', 'utf8')
const overviewService = fs.readFileSync('miniprogram/services/overview.js', 'utf8')
const studentHome = fs.readFileSync('miniprogram/pages/student/index.js', 'utf8')
const app = fs.readFileSync('miniprogram/app.js', 'utf8')
const {
  buildWeeklyRank,
  buildWeeklyTask,
  getWeekRange,
  sanitizeUser
} = require('../cloudfunctions/get-student-overview/helpers')

assert.match(source, /ranking_snapshots/)
assert.match(source, /latest_pending_task/)
assert.match(source, /submitted/)
assert.match(source, /\.field\(/)
assert.doesNotMatch(source, /getAllUsers/)
assert.match(api, /getStudentOverview/)
assert.match(overviewService, /getStudentOverview/)
assert.match(studentHome, /OverviewService\.getStudentOverview/)
assert.doesNotMatch(studentHome, /ClassService|RankingService|TaskService/)
assert.doesNotMatch(app, /AuthService\.getUserInfo\(\)/)

const weekRange = getWeekRange(new Date('2026-09-17T02:00:00.000Z'))
assert.equal(weekRange.start.toISOString(), '2026-09-11T16:00:00.000Z')
assert.equal(weekRange.end.toISOString(), '2026-09-18T16:00:00.000Z')

assert.deepEqual(buildWeeklyRank({
  participant_count: 2,
  list: [{ _openid: 'student-a', rank: 2 }]
}, 'student-a'), {
  rank: 2,
  text: '第 2 名',
  participant_count: 2
})

assert.deepEqual(buildWeeklyTask([
  { _id: 'task-2', publish_time: new Date('2026-09-16T00:00:00.000Z') },
  { _id: 'task-1', publish_time: new Date('2026-09-15T00:00:00.000Z') }
], [
  { task_id: 'task-1' }
]), {
  total: 2,
  submitted: 1,
  latest_pending_task: {
    _id: 'task-2',
    publish_time: new Date('2026-09-16T00:00:00.000Z')
  }
})

assert.deepEqual(buildWeeklyTask([
  { _id: 'expired', deadline: new Date('2026-09-16T00:00:00.000Z') },
  { _id: 'active', deadline: new Date('2026-09-18T00:00:00.000Z') }
], [], new Date('2026-09-17T00:00:00.000Z')), {
  total: 1,
  submitted: 0,
  latest_pending_task: {
    _id: 'active',
    deadline: new Date('2026-09-18T00:00:00.000Z')
  }
})

assert.deepEqual(sanitizeUser({
  _id: 'user-1',
  _openid: 'private-openid',
  user_name: '学生甲',
  phone: '13800000000',
  points: 12,
  roles: ['student'],
  current_role: 'student'
}), {
  _id: 'user-1',
  user_name: '学生甲',
  avatar_url: '',
  school: '',
  grade: '',
  roles: ['student'],
  current_role: 'student',
  points: 12,
  total_points: 12
})
