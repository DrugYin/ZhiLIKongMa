const assert = require('assert')
const fs = require('fs')

const tasks = fs.readFileSync('cloudfunctions/get-tasks/index.js', 'utf8')
const submissions = fs.readFileSync('cloudfunctions/get-submissions/index.js', 'utf8')
const classes = fs.readFileSync('cloudfunctions/get-classes/index.js', 'utf8')
const applications = fs.readFileSync('cloudfunctions/get-class-applications/index.js', 'utf8')
const studentTaskPage = fs.readFileSync('miniprogram/pages/student/task-manage/task-manage.js', 'utf8')
const teacherTaskPage = fs.readFileSync('miniprogram/pages/teacher/task-manage/task-manage.js', 'utf8')
const indexPlan = JSON.parse(fs.readFileSync('docs/cloudbase-performance-indexes.json', 'utf8'))

assert.match(tasks, /TASK_LIST_FIELDS/)
assert.match(tasks, /view === 'detail'/)
assert.match(tasks, /\.field\(TASK_LIST_FIELDS\)/)
assert.match(submissions, /SUBMISSION_LIST_FIELDS/)
assert.match(submissions, /view === 'task_ids'/)
assert.match(submissions, /SUBMISSION_TASK_ID_FIELDS/)
assert.match(classes, /CLASS_LIST_FIELDS/)
assert.match(applications, /APPLICATION_LIST_FIELDS/)

const taskFields = tasks.match(/const TASK_LIST_FIELDS = \{([\s\S]*?)\n\}/)[1]
assert.doesNotMatch(taskFields, /images|files|content/)
const submissionFields = submissions.match(/const SUBMISSION_LIST_FIELDS = \{([\s\S]*?)\n\}/)[1]
assert.doesNotMatch(submissionFields, /images|files|description|feedback/)

assert.match(studentTaskPage, /materialSummaryText/)
assert.match(teacherTaskPage, /materialSummaryText/)

assert.equal(Object.values(indexPlan.collections).flat().length, 8)
assert.deepEqual(indexPlan.collections.tasks[0].MgoKeySchema.MgoIndexKeys, [
  { Name: 'teacher_openid', Direction: '1' },
  { Name: 'is_deleted', Direction: '1' },
  { Name: 'update_time', Direction: '-1' }
])
