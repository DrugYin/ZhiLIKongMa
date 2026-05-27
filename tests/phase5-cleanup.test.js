const assert = require('assert')
const fs = require('fs')

const cloudbaseApi = fs.readFileSync('admin-web/src/api/cloudbase.js', 'utf8')
const lotteryWheel = fs.readFileSync('miniprogram/components/lottery-wheel/index.js', 'utf8')
const createClass = fs.readFileSync('cloudfunctions/create-class/index.js', 'utf8')
const updateClass = fs.readFileSync('cloudfunctions/update-class/index.js', 'utf8')
const empty = fs.readFileSync('miniprogram/components/empty/empty.js', 'utf8')
const loading = fs.readFileSync('miniprogram/components/loading/loading.js', 'utf8')
const navbar = fs.readFileSync('miniprogram/components/custom-navbar/index.js', 'utf8')
const pointsLog = fs.readFileSync('cloudfunctions/_shared/points-log.js', 'utf8')

assert.match(cloudbaseApi, /function getProperty\(source, paths\)/)
assert.doesNotMatch(cloudbaseApi, /response\?\.fileID[\s\S]*response\?\.result\?\.fileId/)

assert.match(lotteryWheel, /requestAnimationFrame/)
assert.doesNotMatch(lotteryWheel, /setTimeout\(animStep, 16\)/)

assert.match(createClass, /CONFIG_CACHE_TTL/)
assert.match(updateClass, /CONFIG_CACHE_TTL/)

assert.doesNotMatch(empty, /^\/\/ components\//m)
assert.doesNotMatch(empty, /data:\s*\{\}/)
assert.doesNotMatch(loading, /^\/\/ components\//m)
assert.doesNotMatch(navbar, /组件的属性列表|组件的方法列表/)
assert.doesNotMatch(pointsLog, /@param|积分变动日志工具模块/)
