const assert = require('assert')
const Module = require('module')

const originalLoad = Module._load
const createdPrizes = []

const db = {
  command: {
    neq(value) {
      return { $neq: value }
    }
  },
  collection(name) {
    assert.strictEqual(name, 'prizes')
    return {
      async add(payload) {
        createdPrizes.push(payload.data)
        return { _id: `prize-${createdPrizes.length}` }
      }
    }
  }
}

Module._load = function mockCloudDependencies(request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return {
      DYNAMIC_CURRENT_ENV: 'test',
      init() {},
      database() {
        return db
      }
    }
  }
  if (request === '/opt/admin-operation-log') {
    return { async writeAdminOperationLog() {} }
  }
  if (request === '/opt/prize-defaults') {
    return { DEFAULT_PRIZES: [] }
  }
  if (request === '/opt/response') {
    return {
      success(message, data) {
        return { success: true, message, data }
      },
      failure(message, errorCode) {
        return { success: false, message, error_code: errorCode }
      }
    }
  }
  if (request === '/opt/admin-auth') {
    return {
      async verifyAdmin() {
        return {
          success: true,
          user: { _id: 'admin-1', roles: ['admin'] }
        }
      },
      hasRole(user, role) {
        return Array.isArray(user.roles) && user.roles.includes(role)
      }
    }
  }
  if (request === '/opt/utils') {
    return require('../cloudfunctions/_shared/utils')
  }
  return originalLoad.call(this, request, parent, isMain)
}

async function createPrize(probability) {
  const { main } = require('../cloudfunctions/admin-manage-prizes')
  return main({
    action: 'create',
    prize: {
      name: `测试奖品-${probability}`,
      type: 'virtual',
      stock: 1,
      probability,
      value: 0,
      status: 'active',
      sort_order: 0
    }
  })
}

async function run() {
  const result = await createPrize(0.123456)

  assert.strictEqual(result.success, true)
  assert.strictEqual(createdPrizes[0].probability, 0.12346)

  const tinyResult = await createPrize(0.00001)

  assert.strictEqual(tinyResult.success, true)
  assert.strictEqual(createdPrizes[1].probability, 0.00001)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    Module._load = originalLoad
  })
