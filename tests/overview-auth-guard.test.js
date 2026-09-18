const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const projectRoot = path.resolve(__dirname, '..')

function createFunctionHarness(relativePath) {
  const filePath = path.join(projectRoot, relativePath)
  const source = fs.readFileSync(filePath, 'utf8')
  const module = { exports: {} }
  let authCalls = 0
  const auth = new Proxy({}, {
    get() {
      return async () => {
        authCalls += 1
        throw new Error('缺少 OPENID 时不应查询用户')
      }
    }
  })
  const helpers = new Proxy({}, {
    get() {
      return () => null
    }
  })
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
            return { command: {} }
          },
          getWXContext() {
            return {}
          }
        }
      }
      if (request === '/opt/auth') return auth
      if (request === '/opt/response') {
        return {
          success(message, data) {
            return { success: true, message, data }
          },
          failure(message, errorCode, extra = {}) {
            return { success: false, message, error_code: errorCode, ...extra }
          }
        }
      }
      if (request === '/opt/membership') return helpers
      if (request === './helpers') return helpers
      return require(request)
    }
  }

  vm.runInNewContext(source, sandbox, { filename: filePath })
  return {
    main: module.exports.main,
    getAuthCalls() {
      return authCalls
    }
  }
}

async function run() {
  const functionFiles = [
    'cloudfunctions/get-student-overview/index.js',
    'cloudfunctions/get-teacher-overview/index.js',
    'cloudfunctions/get-teacher-reviews/index.js'
  ]

  for (const file of functionFiles) {
    const harness = createFunctionHarness(file)
    const result = await harness.main({})
    assert.equal(result.success, false, `${file} 缺少身份时应拒绝请求`)
    assert.equal(result.error_code, 401, `${file} 缺少身份时应返回 401`)
    assert.equal(harness.getAuthCalls(), 0, `${file} 缺少身份时不应查询用户集合`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
