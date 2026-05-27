const assert = require('assert')
const Module = require('module')

const originalLoad = Module._load
Module._load = function mockCloudbase(request, parent, isMain) {
  if (request === '@cloudbase/node-sdk') {
    return {
      init() {
        return {
          auth() {
            return {
              getUserInfo() {
                return { uid: 'admin-uid' }
              }
            }
          }
        }
      }
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

function createCollection(docs = []) {
  const calls = []
  const collection = {
    calls,
    where(condition) {
      calls.push(['where', condition])
      return collection
    },
    limit(value) {
      calls.push(['limit', value])
      return collection
    },
    async get() {
      calls.push(['get'])
      return { data: docs }
    },
    async add(payload) {
      calls.push(['add', payload])
      return { _id: 'log-id' }
    }
  }
  return collection
}

async function run() {
  const adminAuth = require('../cloudfunctions/_shared/admin-auth')
  const utils = require('../cloudfunctions/_shared/utils')
  const config = require('../cloudfunctions/_shared/config')
  const { addPointsLog } = require('../cloudfunctions/_shared/points-log')

  assert.strictEqual(adminAuth.hasRole({ roles: ['admin'] }, 'admin'), true)
  assert.strictEqual(adminAuth.hasRole({ roles: ['student'] }, 'admin'), false)
  assert.strictEqual(await adminAuth.getCallerUid(), 'admin-uid')

  const adminCollection = createCollection([
    { _id: 'u1', roles: ['admin'], status: 'active', admin_status: 'active' }
  ])
  const adminDb = {
    collection(name) {
      assert.strictEqual(name, 'users')
      return adminCollection
    }
  }
  const adminCheck = await adminAuth.verifyAdmin(adminDb)
  assert.strictEqual(adminCheck.success, true)
  assert.strictEqual(adminCheck.uid, 'admin-uid')

  assert.strictEqual(utils.normalizeString('  abc  '), 'abc')
  assert.strictEqual(utils.normalizeString(null), '')
  assert.strictEqual(utils.tryParseInt('12', 0), 12)
  assert.strictEqual(utils.tryParseInt('bad', 7), 7)
  assert.strictEqual(utils.tryParseFloat('0.25', 0), 0.25)
  assert.strictEqual(utils.tryParseFloat('bad', 0.5), 0.5)

  const configCollection = createCollection([
    { config_key: 'enabled', config_value: true },
    { config_key: 'limit', config_value: 5 }
  ])
  const configDb = {
    command: { in(values) { return { $in: values } } },
    collection(name) {
      assert.strictEqual(name, 'system_config')
      return configCollection
    }
  }
  assert.strictEqual(await config.getConfigValue(configDb, 'missing', 'fallback'), 'fallback')
  assert.deepStrictEqual(
    await config.getConfigValues(configDb, ['enabled', 'limit', 'missing'], [false, 0, 'fallback']),
    [true, 5, 'fallback']
  )

  const txCollection = createCollection()
  const tx = {
    serverDate() {
      return 'server-date'
    },
    collection(name) {
      assert.strictEqual(name, 'points_log')
      return txCollection
    }
  }
  await addPointsLog(tx, {
    user_openid: 'openid',
    type: 'expense',
    amount: 10,
    before_points: 30,
    after_points: 20,
    source: 'lottery_cost'
  })
  const addCall = txCollection.calls.find(([name]) => name === 'add')
  assert.ok(addCall)
  assert.strictEqual(addCall[1].data.create_time, 'server-date')
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    Module._load = originalLoad
  })
