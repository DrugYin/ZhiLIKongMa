const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve('miniprogram')
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const mainPages = new Set((appJson.pages || []).map((page) => `/${page}`))
const subpackages = Array.isArray(appJson.subpackages) ? appJson.subpackages : []

assert.ok(subpackages.length >= 3, '应至少包含学生、教师和公共三个分包')

const declaredRoutes = new Set(mainPages)
subpackages.forEach((subpackage) => {
  assert.ok(subpackage.root && Array.isArray(subpackage.pages), '分包必须声明 root 和 pages')
  subpackage.pages.forEach((page) => declaredRoutes.add(`/${subpackage.root}/${page}`))
})

;(appJson.tabBar && appJson.tabBar.list || []).forEach((item) => {
  assert.ok(mainPages.has(`/${item.pagePath}`), `TabBar 页面必须位于主包：${item.pagePath}`)
})

declaredRoutes.forEach((route) => {
  ;['.js', '.json', '.wxml', '.wxss'].forEach((extension) => {
    assert.ok(fs.existsSync(path.join(root, `${route.slice(1)}${extension}`)), `页面文件不存在：${route}${extension}`)
  })
})

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['miniprogram_npm', 'node_modules'].includes(entry.name)) return []
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(fullPath) : [fullPath]
  })
}

const routePattern = /\/(?:pages|subpackages)\/[A-Za-z0-9_./-]+/g
const missingRoutes = []
walk(root)
  .concat(walk(path.resolve('cloudfunctions')))
  .filter((file) => /\.(?:js|json|wxml)$/.test(file) && file !== path.join(root, 'app.json'))
  .forEach((file) => {
    const source = fs.readFileSync(file, 'utf8')
    const matches = source.match(routePattern) || []
    matches.forEach((route) => {
      if (!declaredRoutes.has(route)) {
        missingRoutes.push(`${path.relative(process.cwd(), file)} -> ${route}`)
      }
    })
  })

assert.deepEqual(missingRoutes, [], `发现未声明的小程序路由：\n${missingRoutes.join('\n')}`)
