const projectService = require('../../../../config/project')
const ClassService = require('../../../../services/class')
const TaskService = require('../../../../services/task')
const { uploadFile } = require('../../../../services/api')
const Toast = require('../../../../utils/toast')
const {
  IMAGE_MAX_COUNT,
  IMAGE_MAX_SIZE,
  FILE_MAX_COUNT,
  FILE_MAX_SIZE,
  FILE_ALLOWED_TYPES
} = require('../../../../utils/constant')

const TASK_TYPE_OPTIONS = [
  {
    value: 'public',
    label: '公开任务',
    desc: '所有学生都可以查看'
  },
  {
    value: 'class',
    label: '班级任务',
    desc: '绑定到指定班级发布'
  }
]

const VISIBILITY_OPTIONS = [
  {
    value: 'class_only',
    label: '仅班级成员可见',
    desc: '只有当前班级学生可查看'
  },
  {
    value: 'public',
    label: '公开可见',
    desc: '其他学生也可以查看'
  }
]

const STATUS_OPTIONS = [
  {
    value: 'draft',
    label: '草稿',
    desc: '先保存配置，稍后再发布'
  },
  {
    value: 'published',
    label: '已发布',
    desc: '保存后立即对可见用户生效'
  },
  {
    value: 'closed',
    label: '已关闭',
    desc: '保留任务记录，但不再开放'
  }
]

const DEFAULT_DIFFICULTY_OPTIONS = [
  { value: 1, label: '入门', color: '#52c41a' },
  { value: 2, label: '基础', color: '#1890ff' },
  { value: 3, label: '进阶', color: '#faad14' },
  { value: 4, label: '高级', color: '#ff4d4f' },
  { value: 5, label: '专家', color: '#8c55ff' }
]

const IMAGE_UPLOAD_CONFIG = {
  count: IMAGE_MAX_COUNT.TASK,
  sizeType: ['compressed', 'original'],
  sourceType: ['album', 'camera']
}

const IMAGE_SIZE_LIMIT = {
  size: Math.round(IMAGE_MAX_SIZE / (1024 * 1024)),
  unit: 'MB',
  message: '图片大小不超过 {sizeLimit} MB'
}

const FILE_SIZE_LIMIT = {
  size: Math.round(FILE_MAX_SIZE / (1024 * 1024)),
  unit: 'MB',
  message: '文件大小不超过 {sizeLimit} MB'
}

const IMAGE_GRID_CONFIG = {
  column: 3,
  width: 196,
  height: 196
}

Page({
  data: {
    taskId: '',
    isEdit: false,
    pageTitle: '新建任务',
    pageDesc: '先完成基础配置，后续可以继续补充任务素材、提交规则和统计信息。',
    submitText: '创建任务',
    loading: true,
    saving: false,
    projectPickerVisible: false,
    classPickerVisible: false,
    categoryPickerVisible: false,
    taskInfo: null,
    imageFiles: [],
    fileFiles: [],
    projectOptions: [],
    projectMap: {},
    classList: [],
    classMap: {},
    classOptions: [],
    categoryOptions: [],
    difficultyOptions: DEFAULT_DIFFICULTY_OPTIONS,
    taskTypeOptions: TASK_TYPE_OPTIONS,
    visibilityOptions: VISIBILITY_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    imageUploadConfig: IMAGE_UPLOAD_CONFIG,
    imageSizeLimit: IMAGE_SIZE_LIMIT,
    fileSizeLimit: FILE_SIZE_LIMIT,
    imageGridConfig: IMAGE_GRID_CONFIG,
    imageMediaType: ['image'],
    imageMax: IMAGE_MAX_COUNT.TASK,
    fileMax: FILE_MAX_COUNT,
    fileAcceptText: FILE_ALLOWED_TYPES.join(' / '),
    taskForm: {
      title: '',
      description: '',
      task_type: 'public',
      visibility: 'public',
      class_id: '',
      class_name: '',
      project_code: '',
      project_name: '',
      category: '',
      difficulty: 2,
      points: 10,
      status: 'draft',
      deadline_date: '',
      deadline_time: ''
    }
  },

  onLoad(options) {
    const taskId = String(options.task_id || '').trim()
    const isEdit = Boolean(taskId)
    const initialProjectCode = String(options.project_code || '').trim()
    const initialClassId = String(options.class_id || '').trim()

    this._initialProjectCode = initialProjectCode
    this._initialClassId = initialClassId

    this.setData({
      taskId,
      isEdit,
      pageTitle: isEdit ? '编辑任务' : '新建任务',
      pageDesc: isEdit
        ? '可以调整任务范围、难度、状态和截止时间，保存后会同步更新任务详情。'
        : '先完成基础配置，后续可以继续补充任务素材、提交规则和统计信息。',
      submitText: isEdit ? '保存修改' : '创建任务'
    })

    this.initPage()
  },

  onPullDownRefresh() {
    this.initPage()
  },

  async initPage() {
    this.setData({
      loading: true
    })

    try {
      await Promise.all([
        this.loadProjectOptions(),
        this.loadClassOptions()
      ])

      if (this.data.isEdit) {
        await this.loadTaskDetail()
      } else {
        this.applyInitialParams()
      }
    } catch (error) {
      console.error('[task-edit] initPage error:', error)
      Toast.showToast(error.message || '页面初始化失败')
    } finally {
      this.setData({
        loading: false
      })
      wx.stopPullDownRefresh()
    }
  },

  async loadProjectOptions() {
    const projects = await projectService.getProjects(true)
    const projectOptions = projects.map((item) => ({
      label: item.project_name,
      value: item.project_code
    }))
    const projectMap = projects.reduce((result, item) => {
      result[item.project_code] = item
      return result
    }, {})

    this.setData({
      projectOptions,
      projectMap
    })
  },

  async loadClassOptions() {
    let page = 1
    let hasMore = true
    const classList = []

    while (hasMore) {
      const response = await ClassService.getClasses({
        role: 'teacher',
        page,
        page_size: 50
      })
      const list = Array.isArray(response.list) ? response.list : []

      classList.push(...list)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    const classMap = classList.reduce((result, item) => {
      if (item && item._id) {
        result[item._id] = item
      }
      return result
    }, {})

    this.setData({
      classList,
      classMap
    }, () => {
      this.syncFormDependencies()
    })
  },

  async loadTaskDetail() {
    Toast.showLoading('任务详情加载中...')

    try {
      const taskInfo = await TaskService.getTaskDetail(this.data.taskId)
      const { imageFiles, fileFiles } = await this.buildExistingUploadState(taskInfo)

      this.setData({
        taskInfo,
        imageFiles,
        fileFiles,
        taskForm: {
          title: taskInfo.title || '',
          description: taskInfo.description || '',
          task_type: taskInfo.task_type || 'public',
          visibility: taskInfo.task_type === 'public' ? 'public' : (taskInfo.visibility || 'class_only'),
          class_id: taskInfo.class_id || '',
          class_name: taskInfo.class_name || '',
          project_code: taskInfo.project_code || '',
          project_name: taskInfo.project_name || '',
          category: taskInfo.category || '',
          difficulty: Number(taskInfo.difficulty || 2),
          points: Number(taskInfo.points || 0),
          status: taskInfo.status || 'draft',
          deadline_date: taskInfo.deadline_date || '',
          deadline_time: taskInfo.deadline_time || ''
        }
      }, () => {
        this.syncFormDependencies()
      })
    } finally {
      Toast.hideLoading()
    }
  },

  async buildExistingUploadState(taskInfo = {}) {
    const imageIds = Array.isArray(taskInfo.images) ? taskInfo.images.filter(Boolean) : []
    const fileEntries = Array.isArray(taskInfo.files) ? taskInfo.files.filter((item) => item && item.file_id) : []
    const tempUrlMap = await this.getTempUrlMap(imageIds.concat(fileEntries.map((item) => item.file_id)))

    return {
      imageFiles: imageIds.map((fileId, index) => ({
        url: tempUrlMap[fileId] || fileId,
        type: 'image',
        name: `任务图片${index + 1}`,
        percent: 100,
        status: 'done',
        file_id: fileId
      })),
      fileFiles: fileEntries.map((item) => ({
        url: tempUrlMap[item.file_id] || item.file_id,
        name: item.file_name || this.getFileNameFromPath(item.file_id),
        percent: 100,
        status: 'done',
        file_id: item.file_id,
        size: Number(item.file_size || 0),
        sizeText: this.formatFileSize(item.file_size),
        file_name: item.file_name || this.getFileNameFromPath(item.file_id)
      }))
    }
  },

  getTempUrlMap(fileIds = []) {
    const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)))
    if (!uniqueFileIds.length) {
      return Promise.resolve({})
    }

    return new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: uniqueFileIds,
        success: (res) => {
          const fileList = Array.isArray(res.fileList) ? res.fileList : []
          const map = fileList.reduce((result, item) => {
            if (item && item.fileID) {
              result[item.fileID] = item.tempFileURL || item.fileID
            }
            return result
          }, {})
          resolve(map)
        },
        fail: reject
      })
    }).catch((error) => {
      console.error('[task-edit] getTempUrlMap error:', error)
      return uniqueFileIds.reduce((result, fileId) => {
        result[fileId] = fileId
        return result
      }, {})
    })
  },

  applyInitialParams() {
    const updates = {}
    const initialProject = this.data.projectMap[this._initialProjectCode]
    const initialClass = this.data.classMap[this._initialClassId]

    if (initialProject) {
      updates['taskForm.project_code'] = initialProject.project_code
      updates['taskForm.project_name'] = initialProject.project_name || ''
      updates['taskForm.points'] = Number(initialProject.default_points || 10)
    }

    if (initialClass) {
      updates['taskForm.task_type'] = 'class'
      updates['taskForm.visibility'] = 'class_only'
      updates['taskForm.class_id'] = initialClass._id
      updates['taskForm.class_name'] = initialClass.class_name || ''
      updates['taskForm.project_code'] = initialClass.project_code || updates['taskForm.project_code'] || ''
      updates['taskForm.project_name'] = initialClass.project_name || updates['taskForm.project_name'] || ''
    }

    if (Object.keys(updates).length) {
      this.setData(updates, () => {
        this.syncFormDependencies({
          useProjectDefaults: true
        })
      })
      return
    }

    this.syncFormDependencies({
      useProjectDefaults: true
    })
  },

  syncFormDependencies({ useProjectDefaults = false } = {}) {
    const form = {
      ...this.data.taskForm
    }
    const selectedClass = form.class_id ? this.data.classMap[form.class_id] : null

    if (form.task_type !== 'class') {
      form.visibility = 'public'
      form.class_id = ''
      form.class_name = ''
    } else {
      if (!selectedClass) {
        form.class_name = ''
      } else {
        form.class_name = selectedClass.class_name || ''
        if (selectedClass.project_code) {
          form.project_code = selectedClass.project_code
          form.project_name = selectedClass.project_name || ''
        }
      }

      if (!VISIBILITY_OPTIONS.some((item) => item.value === form.visibility)) {
        form.visibility = 'class_only'
      }
    }

    const project = form.project_code ? this.data.projectMap[form.project_code] : null

    if (project) {
      form.project_name = project.project_name || form.project_name || ''
    } else if (form.task_type !== 'class') {
      form.project_name = ''
    }

    const categoryOptions = Array.isArray(project && project.task_categories)
      ? project.task_categories.map((item) => ({
        label: item,
        value: item
      }))
      : []

    if (form.category && !categoryOptions.some((item) => item.value === form.category)) {
      form.category = ''
    }

    if (!form.category && categoryOptions.length) {
      form.category = categoryOptions[0].value
    }

    const difficultyOptions = Array.isArray(project && project.difficulty_levels) && project.difficulty_levels.length
      ? project.difficulty_levels.map((item) => ({
        label: item.name,
        value: Number(item.level),
        color: item.color || '#1f7ae0'
      }))
      : DEFAULT_DIFFICULTY_OPTIONS

    if (!difficultyOptions.some((item) => Number(item.value) === Number(form.difficulty))) {
      form.difficulty = Number(difficultyOptions[0].value)
    }

    if (useProjectDefaults && project) {
      form.points = Number(project.default_points || 10)
    }

    const classOptions = this.data.classList
      .filter((item) => !form.project_code || item.project_code === form.project_code)
      .map((item) => ({
        label: item.project_name
          ? `${item.class_name} · ${item.project_name}`
          : item.class_name,
        value: item._id
      }))

    if (form.class_id && !classOptions.some((item) => item.value === form.class_id)) {
      form.class_id = ''
      form.class_name = ''
    }

    this.setData({
      taskForm: form,
      categoryOptions,
      difficultyOptions,
      classOptions
    })
  },

  openProjectPicker() {
    this.setData({
      projectPickerVisible: true
    })
  },

  closeProjectPicker() {
    this.setData({
      projectPickerVisible: false
    })
  },

  onProjectChange(e) {
    const value = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value
    const project = this.data.projectMap[value] || {}

    this.setData({
      projectPickerVisible: false,
      'taskForm.project_code': value || '',
      'taskForm.project_name': project.project_name || ''
    }, () => {
      this.syncFormDependencies({
        useProjectDefaults: true
      })
    })
  },

  openClassPicker() {
    if (this.data.taskForm.task_type !== 'class') {
      return
    }

    if (!this.data.classOptions.length) {
      Toast.showToast('当前项目下暂无可选班级')
      return
    }

    this.setData({
      classPickerVisible: true
    })
  },

  closeClassPicker() {
    this.setData({
      classPickerVisible: false
    })
  },

  onClassChange(e) {
    const value = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value
    const classInfo = this.data.classMap[value] || {}

    this.setData({
      classPickerVisible: false,
      'taskForm.class_id': value || '',
      'taskForm.class_name': classInfo.class_name || '',
      'taskForm.project_code': classInfo.project_code || this.data.taskForm.project_code,
      'taskForm.project_name': classInfo.project_name || this.data.taskForm.project_name
    }, () => {
      this.syncFormDependencies({
        useProjectDefaults: true
      })
    })
  },

  openCategoryPicker() {
    if (!this.data.taskForm.project_code) {
      Toast.showToast('请先选择所属项目')
      return
    }

    if (!this.data.categoryOptions.length) {
      Toast.showToast('当前项目暂未配置任务分类')
      return
    }

    this.setData({
      categoryPickerVisible: true
    })
  },

  closeCategoryPicker() {
    this.setData({
      categoryPickerVisible: false
    })
  },

  onCategoryChange(e) {
    const value = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value

    this.setData({
      categoryPickerVisible: false,
      'taskForm.category': value || ''
    })
  },

  onImageAdd(e) {
    const files = this.normalizeUploadEventFiles(e)
    if (!files.length) {
      return
    }

    const pendingFiles = files.map((item, index) => this.createPendingUploadFile(item, 'image', index))
    this.setData({
      imageFiles: this.data.imageFiles.concat(pendingFiles)
    }, () => {
      this.uploadSelectedFiles('imageFiles', 'images', pendingFiles)
    })
  },

  async onSelectFiles() {
    const remainCount = this.data.fileMax - this.data.fileFiles.length

    if (remainCount <= 0) {
      Toast.showToast(`最多上传 ${this.data.fileMax} 个附件`)
      return
    }

    try {
      const chooseResult = await this.chooseMessageFiles(remainCount)
      const files = Array.isArray(chooseResult.tempFiles) ? chooseResult.tempFiles : []
      if (!files.length) {
        return
      }

      const invalidFile = files.find((item) => !this.isAllowedAttachment(item))
      if (invalidFile) {
        Toast.showToast(`附件格式暂不支持，仅支持：${FILE_ALLOWED_TYPES.join('、')}`)
        return
      }

      const oversizeFile = files.find((item) => Number(item.size || 0) > FILE_MAX_SIZE)
      if (oversizeFile) {
        Toast.showToast(`单个附件大小不能超过 ${FILE_SIZE_LIMIT.size} MB`)
        return
      }

      const pendingFiles = files.map((item, index) => this.createPendingUploadFile({
        ...item,
        url: item.path
      }, 'file', index))

      this.setData({
        fileFiles: this.data.fileFiles.concat(pendingFiles)
      }, () => {
        this.uploadSelectedFiles('fileFiles', 'files', pendingFiles)
      })
    } catch (error) {
      if (error && /cancel/i.test(String(error.errMsg || error.message || ''))) {
        return
      }
      console.error('[task-edit] onSelectFiles error:', error)
      Toast.showToast('选择附件失败')
    }
  },

  chooseMessageFiles(count) {
    return new Promise((resolve, reject) => {
      wx.chooseMessageFile({
        count: Math.min(count, FILE_MAX_COUNT),
        type: 'file',
        success: resolve,
        fail: reject
      })
    })
  },

  onImageRemove(e) {
    const { index } = e.detail || {}
    this.removeUploadFileAt('imageFiles', index)
  },

  onDeleteFile(e) {
    const { index } = e.currentTarget.dataset
    this.removeUploadFileAt('fileFiles', Number(index))
  },

  removeUploadFileAt(field, index) {
    if (!Number.isInteger(index) || index < 0) {
      return
    }

    const nextFiles = (this.data[field] || []).slice()
    nextFiles.splice(index, 1)
    this.setData({
      [field]: nextFiles
    })
  },

  normalizeUploadEventFiles(event) {
    const detail = event && event.detail
    if (detail && Array.isArray(detail.files)) {
      return detail.files
    }

    if (Array.isArray(detail)) {
      return detail
    }

    return []
  },

  createPendingUploadFile(file, kind, index) {
    return {
      ...file,
      name: file.name || this.getFileNameFromPath(file.url) || `${kind === 'image' ? '图片' : '附件'}${index + 1}`,
      sizeText: this.formatFileSize(file.size),
      percent: 0,
      status: 'loading',
      _uploadId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${index}`,
      _uploadKind: kind
    }
  },

  async uploadSelectedFiles(field, folder, files) {
    const uploaded = []
    const failed = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]

      try {
        const cloudPath = this.buildCloudPath(folder, file, index)
        const result = await uploadFile(file.url, cloudPath)
        uploaded.push({
          ...file,
          percent: 100,
          status: 'done',
          localPath: file.localPath || file.url,
          file_id: result.fileID,
          sizeText: this.formatFileSize(file.size),
          file_name: file.name || this.getFileNameFromPath(file.url)
        })
      } catch (error) {
        console.error('[task-edit] uploadSelectedFiles error:', error)
        failed.push({
          ...file,
          percent: 0,
          status: 'failed'
        })
      }
    }

    this.replaceUploadFiles(field, uploaded.concat(failed))

    if (failed.length) {
      Toast.showToast(`${failed.length} 个${field === 'imageFiles' ? '图片' : '附件'}上传失败，可移除后重试`)
      return
    }

    if (uploaded.length) {
      Toast.showSuccess(`${uploaded.length} 个${field === 'imageFiles' ? '图片' : '附件'}上传成功`, 1500)
    }
  },

  replaceUploadFiles(field, changedFiles) {
    const changedMap = changedFiles.reduce((result, item) => {
      if (item && item._uploadId) {
        result[item._uploadId] = item
      }
      return result
    }, {})

    const nextFiles = (this.data[field] || []).map((item) => changedMap[item._uploadId] || item)

    this.setData({
      [field]: nextFiles
    })
  },

  buildCloudPath(folder, file, index) {
    const extension = this.getFileExtension(file.url || file.name)
    const fileName = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}${extension}`
    const date = new Date()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')

    return `tasks/${folder}/${date.getFullYear()}${month}${day}/${fileName}`
  },

  getFileExtension(filePath = '') {
    const value = String(filePath || '')
    const index = value.lastIndexOf('.')
    if (index < 0) {
      return ''
    }

    return value.slice(index)
  },

  getFileNameFromPath(filePath = '') {
    const value = String(filePath || '')
    const parts = value.split(/[\\/]/)
    return parts[parts.length - 1] || ''
  },

  formatFileSize(size) {
    const value = Number(size || 0)
    if (!value) {
      return '未知大小'
    }

    if (value < 1024) {
      return `${value} B`
    }

    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`
    }

    if (value < 1024 * 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`
    }

    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
  },

  isAllowedAttachment(file = {}) {
    const name = file.name || this.getFileNameFromPath(file.url)
    const extension = this.getFileExtension(name).replace('.', '').toLowerCase()

    if (!extension) {
      return false
    }

    return FILE_ALLOWED_TYPES.includes(extension)
  },

  async onPreviewFile(e) {
    const { index } = e.currentTarget.dataset
    const file = this.data.fileFiles[Number(index)]

    if (!file) {
      return
    }

    if (file.status === 'loading') {
      Toast.showToast('附件上传中，请稍后预览')
      return
    }

    if (file.status === 'failed') {
      Toast.showToast('该附件上传失败，请移除后重新上传')
      return
    }

    Toast.showLoading('正在打开附件...')

    try {
      const filePath = await this.resolvePreviewFilePath(file)
      await this.openDocument(filePath)
      Toast.hideLoading()
    } catch (error) {
      console.error('[task-edit] onPreviewFile error:', error)
      Toast.hideLoading()
      Toast.showToast('附件预览失败')
    }
  },

  async resolvePreviewFilePath(file = {}) {
    if (file.localPath) {
      return file.localPath
    }

    if (file.url && !/^https?:\/\//i.test(file.url) && !/^cloud:\/\//i.test(file.url)) {
      return file.url
    }

    if (file.file_id) {
      const result = await this.downloadCloudFile(file.file_id)
      this.updateFilePreviewPath(file, result.tempFilePath)
      return result.tempFilePath
    }

    if (file.url && /^https?:\/\//i.test(file.url)) {
      const result = await this.downloadHttpFile(file.url)
      this.updateFilePreviewPath(file, result.tempFilePath)
      return result.tempFilePath
    }

    throw new Error('无可用预览地址')
  },

  downloadCloudFile(fileId) {
    return new Promise((resolve, reject) => {
      wx.cloud.downloadFile({
        fileID: fileId,
        success: resolve,
        fail: reject
      })
    })
  },

  downloadHttpFile(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              tempFilePath: res.tempFilePath
            })
            return
          }

          reject(new Error(`download failed: ${res.statusCode}`))
        },
        fail: reject
      })
    })
  },

  updateFilePreviewPath(file, localPath) {
    const targetUploadId = file._uploadId
    const targetFileId = file.file_id
    const nextFiles = this.data.fileFiles.map((item) => {
      if ((targetUploadId && item._uploadId === targetUploadId) || (targetFileId && item.file_id === targetFileId)) {
        return {
          ...item,
          localPath
        }
      }

      return item
    })

    this.setData({
      fileFiles: nextFiles
    })
  },

  openDocument(filePath) {
    return new Promise((resolve, reject) => {
      wx.openDocument({
        filePath,
        showMenu: true,
        success: resolve,
        fail: reject
      })
    })
  },

  onTaskTypeSelect(e) {
    const { value } = e.currentTarget.dataset
    if (!value || value === this.data.taskForm.task_type) {
      return
    }

    this.setData({
      'taskForm.task_type': value,
      'taskForm.visibility': value === 'class' ? 'class_only' : 'public'
    }, () => {
      this.syncFormDependencies()
    })
  },

  onVisibilitySelect(e) {
    const { value } = e.currentTarget.dataset
    if (!value || this.data.taskForm.task_type !== 'class') {
      return
    }

    this.setData({
      'taskForm.visibility': value
    })
  },

  onStatusSelect(e) {
    const { value } = e.currentTarget.dataset
    if (!value) {
      return
    }

    this.setData({
      'taskForm.status': value
    })
  },

  onDifficultySelect(e) {
    const value = Number(e.currentTarget.dataset.value || 0)
    if (!value) {
      return
    }

    this.setData({
      'taskForm.difficulty': value
    })
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value

    this.setData({
      [`taskForm.${field}`]: typeof value === 'string' ? value.trimStart() : value
    })
  },

  onNumberChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    const normalized = value === '' ? '' : Number(value)

    this.setData({
      [`taskForm.${field}`]: Number.isNaN(normalized) ? 0 : normalized
    })
  },

  onDeadlineDateChange(e) {
    this.setData({
      'taskForm.deadline_date': e.detail.value
    })
  },

  onDeadlineTimeChange(e) {
    this.setData({
      'taskForm.deadline_time': e.detail.value
    })
  },

  onClearDeadline() {
    this.setData({
      'taskForm.deadline_date': '',
      'taskForm.deadline_time': ''
    })
  },

  validateForm() {
    const { taskForm } = this.data
    const allUploadFiles = this.data.imageFiles.concat(this.data.fileFiles)

    if (!taskForm.title.trim()) {
      Toast.showToast('请填写任务标题')
      return false
    }

    if (!taskForm.project_code) {
      Toast.showToast('请选择所属项目')
      return false
    }

    if (taskForm.task_type === 'class' && !taskForm.class_id) {
      Toast.showToast('请选择所属班级')
      return false
    }

    if (!Number.isInteger(Number(taskForm.difficulty)) || Number(taskForm.difficulty) < 1 || Number(taskForm.difficulty) > 5) {
      Toast.showToast('请选择任务难度')
      return false
    }

    if (!Number.isInteger(Number(taskForm.points)) || Number(taskForm.points) < 0) {
      Toast.showToast('请填写正确的任务积分')
      return false
    }

    if ((taskForm.deadline_date && !taskForm.deadline_time) || (!taskForm.deadline_date && taskForm.deadline_time)) {
      Toast.showToast('截止日期和截止时间需要同时填写')
      return false
    }

    if (allUploadFiles.some((item) => item.status === 'loading')) {
      Toast.showToast('附件上传中，请稍后再保存')
      return false
    }

    if (allUploadFiles.some((item) => item.status === 'failed')) {
      Toast.showToast('存在上传失败的附件，请移除后重试')
      return false
    }

    return true
  },

  buildPayload() {
    const { taskForm } = this.data

    return {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      task_type: taskForm.task_type,
      visibility: taskForm.task_type === 'public' ? 'public' : taskForm.visibility,
      class_id: taskForm.task_type === 'class' ? taskForm.class_id : '',
      project_code: taskForm.project_code,
      project_name: taskForm.project_name,
      category: taskForm.category,
      difficulty: Number(taskForm.difficulty),
      points: Number(taskForm.points),
      status: taskForm.status,
      deadline_date: taskForm.deadline_date,
      deadline_time: taskForm.deadline_time,
      images: this.data.imageFiles
        .filter((item) => item.status === 'done' && item.file_id)
        .map((item) => item.file_id),
      files: this.data.fileFiles
        .filter((item) => item.status === 'done' && item.file_id)
        .map((item) => ({
          file_id: item.file_id,
          file_name: item.file_name || item.name || this.getFileNameFromPath(item.url),
          file_size: Number(item.size || 0)
        }))
    }
  },

  async onSubmit() {
    if (!this.validateForm() || this.data.saving) {
      return
    }

    this.setData({
      saving: true
    })

    try {
      const payload = this.buildPayload()
      const result = this.data.isEdit
        ? await TaskService.updateTask({
          task_id: this.data.taskId,
          ...payload
        })
        : await TaskService.createTask(payload)

      await Toast.showSuccess(this.data.isEdit ? '任务更新成功' : '任务创建成功')

      const taskId = result && result._id
      if (taskId) {
        setTimeout(() => {
          if (this.data.isEdit) {
            wx.navigateBack()
          } else {
            wx.redirectTo({
              url: `/pages/teacher/task-manage/task-detail/task-detail?task_id=${taskId}`
            })
          }
        }, 800)
      }
    } catch (error) {
      console.error('[task-edit] onSubmit error:', error)
      Toast.showToast(error.message || (this.data.isEdit ? '任务更新失败' : '任务创建失败'))
    } finally {
      this.setData({
        saving: false
      })
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.pageTitle,
      path: '/pages/teacher/task-manage/task-manage'
    }
  }
})
