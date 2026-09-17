const assert = require('assert')
const fs = require('fs')

const appJson = JSON.parse(fs.readFileSync('miniprogram/app.json', 'utf8'))
const studentHome = fs.readFileSync('miniprogram/pages/student/index.js', 'utf8')
const teacherHome = fs.readFileSync('miniprogram/pages/teacher/index.js', 'utf8')
const pendingPage = fs.readFileSync('miniprogram/pages/teacher/pending/pending.js', 'utf8')

assert.ok(Array.isArray(appJson.subpackages) && appJson.subpackages.length >= 2)
assert.match(studentHome, /OverviewService\.getStudentOverview/)
assert.match(teacherHome, /OverviewService\.getTeacherOverview/)
assert.match(pendingPage, /OverviewService\.getTeacherReviews/)
assert.doesNotMatch(pendingPage, /targetClasses\.map\(c => buildAppPromise/)
