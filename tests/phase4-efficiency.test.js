const assert = require('assert')
const fs = require('fs')

const drawRecords = fs.readFileSync('cloudfunctions/admin-manage-draw-records/index.js', 'utf8')
const prizes = fs.readFileSync('cloudfunctions/admin-manage-prizes/index.js', 'utf8')
const getPrizes = fs.readFileSync('cloudfunctions/get-prizes/index.js', 'utf8')
const pointsLogPage = fs.readFileSync('admin-web/src/pages/points-log/PointsLogPage.vue', 'utf8')

assert.match(drawRecords, /\.where\(queryData\)\.count\(\)/)
assert.match(drawRecords, /\.orderBy\('create_time', 'desc'\)[\s\S]*\.skip\(\(page - 1\) \* pageSize\)[\s\S]*\.limit\(pageSize\)/)
assert.match(drawRecords, /db\.RegExp\(/)
assert.match(drawRecords, /where\(\{\s*_id:\s*id,\s*is_redeemed:\s*false\s*\}\)/s)
assert.doesNotMatch(drawRecords, /if \(record\.is_redeemed\)/)

assert.match(prizes, /const LIMIT = 200/)
assert.match(prizes, /db\.RegExp\(/)
assert.match(prizes, /name:\s*db\.command\.in\(defaultNames\)/)
assert.doesNotMatch(prizes, /for \(const item of DEFAULT_PRIZES\)[\s\S]*\.count\(\)/)

assert.match(getPrizes, /is_deleted:\s*db\.command\.neq\(true\)/)

assert.match(pointsLogPage, /PageHeader/)
assert.match(pointsLogPage, /getPointsLogList/)
assert.match(pointsLogPage, /MessagePlugin\.error/)
assert.match(pointsLogPage, /formatDateTime/)
