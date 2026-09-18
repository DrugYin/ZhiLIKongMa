const assert = require('assert')
const fs = require('fs')

const source = fs.readFileSync('cloudfunctions/get-teacher-overview/index.js', 'utf8')
const api = fs.readFileSync('miniprogram/services/api.js', 'utf8')
const overviewService = fs.readFileSync('miniprogram/services/overview.js', 'utf8')
const teacherHome = fs.readFileSync('miniprogram/pages/teacher/index.js', 'utf8')
const {
  buildOverview,
  buildRecentActivities,
  getWeekRange
} = require('../cloudfunctions/get-teacher-overview/helpers')

assert.match(source, /pending_submission_count/)
assert.match(source, /pending_application_count/)
assert.match(source, /recent_activities/)
assert.match(source, /\.aggregate\(\)/)
assert.match(source, /chunkList\(classIds/)
assert.doesNotMatch(source, /page <= 10/)
assert.doesNotMatch(source, /list\.push\(\.\.\.currentList\)/)
assert.match(api, /getTeacherOverview/)
assert.match(overviewService, /getTeacherOverview/)
assert.match(teacherHome, /OverviewService\.getTeacherOverview/)
assert.match(teacherHome, /overview\.student_count/)
assert.match(teacherHome, /weeklyStats\.submitted_student_count/)
assert.doesNotMatch(teacherHome, /fetchAllTeacherSubmissions|fetchAllPendingApplications|fetchClassPendingApplications|fetchAllClasses|fetchAllTasks/)

assert.deepEqual(buildOverview([
  { _id: 'class-1', member_count: 12 },
  { _id: 'class-2', member_count: 8 }
], 4, 3, 2), {
  class_count: 2,
  task_count: 4,
  student_count: 20,
  pending_submission_count: 3,
  pending_application_count: 2
})

assert.deepEqual(buildRecentActivities({
  latestSubmission: {
    _id: 'submission-1',
    student_name: '学生甲',
    task_title: '任务甲',
    submit_time: new Date('2026-09-18T03:00:00.000Z')
  },
  latestApplication: {
    _id: 'application-1',
    student_name: '学生乙',
    class_name: '班级甲',
    create_time: new Date('2026-09-18T02:00:00.000Z')
  },
  latestTask: {
    _id: 'task-1',
    title: '任务乙',
    update_time: new Date('2026-09-18T01:00:00.000Z')
  },
  latestClass: {
    _id: 'class-1',
    class_name: '班级乙',
    member_count: 10,
    update_time: new Date('2026-09-18T00:00:00.000Z')
  }
}).map((item) => item.id), [
  'submission-submission-1',
  'application-application-1',
  'task-task-1',
  'class-class-1'
])

const weekRange = getWeekRange(new Date('2026-09-18T02:00:00.000Z'))
assert.equal(weekRange.start.toISOString(), '2026-09-11T16:00:00.000Z')
assert.equal(weekRange.end.toISOString(), '2026-09-18T16:00:00.000Z')
