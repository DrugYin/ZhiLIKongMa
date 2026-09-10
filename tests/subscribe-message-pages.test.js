const assert = require('assert')
const Module = require('module')
const path = require('path')

function loadPage(filePath, stubs) {
  const absolutePath = path.resolve(filePath)
  const originalLoad = Module._load
  const originalPage = global.Page
  let pageDefinition = null

  Module._load = function loadStub(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request]
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  global.Page = (definition) => {
    pageDefinition = definition
  }

  try {
    delete require.cache[absolutePath]
    require(absolutePath)
    return pageDefinition
  } finally {
    Module._load = originalLoad
    global.Page = originalPage
  }
}

function setByPath(target, key, value) {
  const pathParts = key.split('.')
  let current = target
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    current[pathParts[index]] = current[pathParts[index]] || {}
    current = current[pathParts[index]]
  }
  current[pathParts[pathParts.length - 1]] = value
}

function createPageContext(definition, data = {}) {
  return {
    ...definition,
    data: {
      ...definition.data,
      ...data
    },
    setData(updates, callback) {
      for (const [key, value] of Object.entries(updates)) {
        setByPath(this.data, key, value)
      }
      if (callback) callback()
    }
  }
}

async function testStudentRequestsBeforeSubmitting() {
  const events = []
  const taskService = {
    async submitTask() {
      events.push('submit')
      return { _id: 'submission-1' }
    }
  }
  const page = loadPage('miniprogram/pages/student/task-manage/submission-edit/submission-edit.js', {
    '../../../../services/task': taskService,
    '../../../../services/api': { uploadFile() {} },
    '../../../../services/subscribe-message': {
      async requestStudentTaskNotifications() {
        events.push('subscribe')
        throw new Error('subscription unavailable')
      }
    },
    '../../../../utils/toast': {
      async showSuccess() {},
      showToast() {},
      showLoading() {},
      hideLoading() {}
    },
    '../../../../utils/format': { formatDate() { return '' } },
    '../../../../utils/file-resource': {},
    '../../../../utils/task-deadline': { formatTaskDeadline() { return '' } },
    '../../../../utils/constant': {
      IMAGE_MAX_COUNT: { SUBMISSION: 3 },
      IMAGE_MAX_SIZE: 5 * 1024 * 1024,
      FILE_MAX_COUNT: 3,
      FILE_MAX_SIZE: 20 * 1024 * 1024,
      FILE_ALLOWED_TYPES: ['pdf'],
      SUBMISSION_STATUS_TEXT: {},
      SUBMISSION_STATUS_COLOR: {}
    }
  })
  const context = createPageContext(page, { saving: false, taskId: 'task-1' })
  context.validateForm = () => true
  context.buildPayload = () => ({ task_id: 'task-1' })

  const originalSetTimeout = global.setTimeout
  const originalWarn = console.warn
  global.setTimeout = () => 0
  console.warn = () => {}
  try {
    await context.onSubmit()
  } finally {
    global.setTimeout = originalSetTimeout
    console.warn = originalWarn
  }

  assert.deepStrictEqual(events, ['subscribe', 'submit'])
  assert.strictEqual(context.data.saving, false)
}

async function testTeacherGuideQueuesAnnouncements() {
  const events = []
  const toast = {
    showSuccess(message) {
      events.push(message)
    },
    showToast() {},
    showLoading() {},
    hideLoading() {}
  }
  const page = loadPage('miniprogram/pages/teacher/index.js', {
    '../../services/auth': {},
    '../../services/class': {},
    '../../services/task': {},
    '../../services/announcement': {
      async getPopupAnnouncements() {
        return { popup_list: [{ _id: 'notice-1' }] }
      }
    },
    '../../services/subscribe-message': {
      TEMPLATE_IDS: { TASK_SUBMITTED: 'template-1' },
      async requestTeacherSubmissionReminder() {
        events.push('subscribe')
        return { accepted: ['template-1'] }
      }
    },
    '../../utils/format': {},
    '../../utils/toast': toast
  })

  let resolveLogin
  const loginGate = new Promise((resolve) => {
    resolveLogin = resolve
  })
  const lifecycleContext = createPageContext(page, {
    subscribeGuideVisible: false,
    popupAnnouncements: [],
    announcementVisible: false
  })
  lifecycleContext.initPage = () => {
    events.push('init')
  }
  const originalGetApp = global.getApp
  global.getApp = () => ({ awaitLogin: () => loginGate })
  let onLoadPromise
  try {
    onLoadPromise = lifecycleContext.onLoad()
    assert.strictEqual(lifecycleContext.data.subscribeGuideVisible, false)
    await lifecycleContext.loadPopupAnnouncements()
    assert.strictEqual(lifecycleContext.data.announcementVisible, false)
    resolveLogin()
    await onLoadPromise
  } finally {
    global.getApp = originalGetApp
  }
  assert.strictEqual(lifecycleContext.data.subscribeGuideVisible, true)
  assert.deepStrictEqual(events, ['init'])
  events.length = 0

  const context = createPageContext(page, {
    subscribeGuideVisible: true,
    popupAnnouncements: [],
    announcementVisible: false
  })

  await context.loadPopupAnnouncements()
  assert.strictEqual(context.data.popupAnnouncements.length, 1)
  assert.strictEqual(context.data.announcementVisible, false)

  await context.handleEnableSubmissionReminder()
  assert.deepStrictEqual(events, ['subscribe', '提交提醒已开启'])
  assert.strictEqual(context.data.subscribeGuideVisible, false)
  assert.strictEqual(context.data.announcementVisible, true)
}

Promise.resolve()
  .then(testStudentRequestsBeforeSubmitting)
  .then(testTeacherGuideQueuesAnnouncements)
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
