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

async function testStudentRequestsBeforeJoiningClass() {
  const events = []
  const page = loadPage('miniprogram/pages/student/class-manage/join-confirm/join-confirm.js', {
    '../../../../services/auth': {},
    '../../../../services/class': {
      async joinClass() {
        events.push('join')
      }
    },
    '../../../../services/subscribe-message': {
      async requestStudentTaskNotifications() {
        events.push('subscribe')
        throw new Error('subscription unavailable')
      }
    },
    '../../../../utils/toast': {
      async showSuccess() {},
      showToast() {},
      showLoading() {
        events.push('loading')
      },
      hideLoading() {}
    }
  })
  const context = createPageContext(page, {
    submitting: false,
    isLoggedIn: true,
    isRegistered: true,
    inviteInfo: { isFull: false },
    hasJoinedCurrentClass: false,
    hasPendingCurrentApplication: false,
    classCode: 'ABC123',
    applyReason: ''
  })
  context.goToClassManage = () => {}

  const originalSetTimeout = global.setTimeout
  const originalWarn = console.warn
  global.setTimeout = () => 0
  console.warn = () => {}
  try {
    await context.onApplyJoin()
  } finally {
    global.setTimeout = originalSetTimeout
    console.warn = originalWarn
  }

  assert.deepStrictEqual(events, ['subscribe', 'loading', 'join'])
  assert.strictEqual(context.data.submitting, false)
}

async function testTeacherRequestsBeforeCreatingClass() {
  const events = []
  const page = loadPage('miniprogram/pages/teacher/class-manage/class-edit/class-edit.js', {
    '../../../../config/project': {},
    '../../../../services/class': {
      async createClass() {
        events.push('create')
        return {}
      },
      async updateClass() {
        events.push('update')
        return {}
      }
    },
    '../../../../services/subscribe-message': {
      async requestTeacherSubmissionReminder() {
        events.push('subscribe')
        throw new Error('subscription unavailable')
      }
    },
    '../../../../utils/toast': {
      async showSuccess() {},
      showToast() {}
    }
  })
  const classForm = {
    class_name: '测试班级',
    project_code: 'CSP-J',
    project_name: 'CSP-J',
    max_members: 30,
    class_time: '',
    location: '',
    description: ''
  }
  const createContext = createPageContext(page, {
    isEdit: false,
    saving: false,
    classForm
  })
  createContext.validateForm = () => true

  const originalWarn = console.warn
  console.warn = () => {}
  try {
    await createContext.onSubmit()
  } finally {
    console.warn = originalWarn
  }
  assert.deepStrictEqual(events, ['subscribe', 'create'])

  events.length = 0
  const editContext = createPageContext(page, {
    isEdit: true,
    classId: 'class-1',
    saving: false,
    classForm
  })
  editContext.validateForm = () => true
  await editContext.onSubmit()
  assert.deepStrictEqual(events, ['update'])
}

async function testTeacherRequestsOnlyWhenPublishingTask() {
  const events = []
  const page = loadPage('miniprogram/pages/teacher/task-manage/task-edit/task-edit.js', {
    '../../../../config/project': {},
    '../../../../services/class': {},
    '../../../../services/task': {
      async createTask() {
        events.push('create')
        return {}
      },
      async updateTask() {
        events.push('update')
        return {}
      }
    },
    '../../../../services/api': { uploadFile() {} },
    '../../../../services/subscribe-message': {
      async requestTeacherSubmissionReminder() {
        events.push('subscribe')
        throw new Error('subscription unavailable')
      }
    },
    '../../../../utils/toast': {
      async showSuccess() {},
      showToast() {}
    },
    '../../../../utils/file-resource': {},
    '../../../../utils/constant': {
      IMAGE_MAX_COUNT: { TASK: 3 },
      IMAGE_MAX_SIZE: 5 * 1024 * 1024,
      FILE_MAX_COUNT: 3,
      FILE_MAX_SIZE: 20 * 1024 * 1024,
      FILE_ALLOWED_TYPES: ['pdf']
    }
  })

  async function submit({ isEdit, previousStatus, nextStatus }) {
    const context = createPageContext(page, {
      isEdit,
      taskId: isEdit ? 'task-1' : '',
      taskInfo: isEdit ? { status: previousStatus } : null,
      saving: false
    })
    context.validateForm = () => true
    context.buildPayload = () => ({ status: nextStatus })
    await context.onSubmit()
  }

  const originalWarn = console.warn
  console.warn = () => {}
  try {
    await submit({ isEdit: false, previousStatus: '', nextStatus: 'published' })
    assert.deepStrictEqual(events, ['subscribe', 'create'])

    events.length = 0
    await submit({ isEdit: false, previousStatus: '', nextStatus: 'draft' })
    assert.deepStrictEqual(events, ['create'])

    events.length = 0
    await submit({ isEdit: true, previousStatus: 'draft', nextStatus: 'published' })
    assert.deepStrictEqual(events, ['subscribe', 'update'])

    events.length = 0
    await submit({ isEdit: true, previousStatus: 'published', nextStatus: 'published' })
    assert.deepStrictEqual(events, ['update'])
  } finally {
    console.warn = originalWarn
  }
}

async function testTeacherHomeDoesNotShowSubscriptionGuide() {
  const events = []
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
      async requestTeacherSubmissionReminder() {
        events.push('subscribe')
        return { accepted: [] }
      }
    },
    '../../utils/format': {},
    '../../utils/toast': {
      showLoading() {},
      hideLoading() {}
    }
  })

  let resolveLogin
  const loginGate = new Promise((resolve) => {
    resolveLogin = resolve
  })
  const lifecycleContext = createPageContext(page, {
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
    await lifecycleContext.loadPopupAnnouncements()
    assert.strictEqual(lifecycleContext.data.announcementVisible, false)
    resolveLogin()
    await onLoadPromise
  } finally {
    global.getApp = originalGetApp
  }
  assert.strictEqual(Boolean(lifecycleContext.data.subscribeGuideVisible), false)
  assert.strictEqual(lifecycleContext.data.announcementVisible, true)
  assert.deepStrictEqual(events, ['init'])
}

Promise.resolve()
  .then(testStudentRequestsBeforeSubmitting)
  .then(testStudentRequestsBeforeJoiningClass)
  .then(testTeacherRequestsBeforeCreatingClass)
  .then(testTeacherRequestsOnlyWhenPublishingTask)
  .then(testTeacherHomeDoesNotShowSubscriptionGuide)
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
