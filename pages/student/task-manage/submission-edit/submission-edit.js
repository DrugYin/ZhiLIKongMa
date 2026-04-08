const TaskService = require('../../../../services/task')
const { uploadFile } = require('../../../../services/api')
const Toast = require('../../../../utils/toast')
const formatUtils = require('../../../../utils/format')
const fileResource = require('../../../../utils/file-resource')
const {
  IMAGE_MAX_COUNT,
  IMAGE_MAX_SIZE,
  FILE_MAX_COUNT,
  FILE_MAX_SIZE,
  FILE_ALLOWED_TYPES,
  SUBMISSION_STATUS_TEXT,
  SUBMISSION_STATUS_COLOR
} = require('../../../../utils/constant')

const IMAGE_UPLOAD_CONFIG = {
  count: IMAGE_MAX_COUNT.SUBMISSION,
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
    loading: true,
    saving: false,
    taskInfo: null,
    latestSubmission: null,
    submissionCount: 0,
    imageFiles: [],
    fileFiles: [],
    imageUploadConfig: IMAGE_UPLOAD_CONFIG,
    imageSizeLimit: IMAGE_SIZE_LIMIT,
    fileSizeLimit: FILE_SIZE_LIMIT,
    imageGridConfig: IMAGE_GRID_CONFIG,
    imageMediaType: ['image'],
    imageMax: IMAGE_MAX_COUNT.SUBMISSION,
    fileMax: FILE_MAX_COUNT,
    fileAcceptText: FILE_ALLOWED_TYPES.join(' / '),
    submitForm: {
      description: ''
    }
  },

  onLoad(options) {
    const taskId = String(options.task_id || '').trim()

    if (!taskId) {
      Toast.showToast('缺少任务ID')
      setTimeout(() => {
        wx.navigateBack()
      }, 1200)
      return
    }

    this.setData({
      taskId
    })

    this.initPage()
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true })
  },

  async initPage({ refreshing = false } = {}) {
    if (!refreshing) {
      Toast.showLoading('提交页加载中...')
    }

    this.setData({
      loading: true
    })

    try {
      const [taskInfo, submissionRes] = await Promise.all([
        TaskService.getTaskDetail(this.data.taskId),
        TaskService.getSubmissions({
          task_id: this.data.taskId,
          page: 1,
          page_size: 1
        })
      ])

      const latestSubmission = Array.isArray(submissionRes.list) && submissionRes.list.length
        ? this.formatSubmissionItem(submissionRes.list[0])
        : null

      this.setData({
        taskInfo: this.formatTaskInfo(taskInfo),
        latestSubmission,
        submissionCount: Number(submissionRes.total || 0)
      })
    } catch (error) {
      console.error('[submission-edit] initPage error:', error)
      Toast.showToast(error.message || '页面加载失败')
    } finally {
      this.setData({
        loading: false
      })
      Toast.hideLoading()
      wx.stopPullDownRefresh()
    }
  },

  formatTaskInfo(item = {}) {
    return {
      ...item,
      titleText: item.title || '未命名任务',
      projectText: item.project_name || item.project_code || '未设置项目',
      classText: item.task_type === 'class'
        ? (item.class_name || '未设置班级')
        : '公开任务',
      teacherText: item.teacher_name || '待老师补充',
      deadlineText: item.deadline || item.deadline_date
        ? this.formatDateTime(item.deadline || `${item.deadline_date} ${item.deadline_time || '00:00'}`)
        : '未设置截止时间',
      pointsText: `${Number(item.points || 0)} 分`
    }
  },

  formatSubmissionItem(item = {}) {
    const status = item.status || 'pending'
    const statusColor = SUBMISSION_STATUS_COLOR[status] || '#faad14'
    const submitNo = Number(item.submit_no || 0)
    const imageCount = Array.isArray(item.images) ? item.images.length : 0
    const fileCount = Array.isArray(item.files) ? item.files.length : 0

    return {
      ...item,
      submitNoText: submitNo || '--',
      statusText: SUBMISSION_STATUS_TEXT[status] || '待处理',
      statusStyle: `color:${statusColor};background:${this.toRgba(statusColor, 0.12)};`,
      submitTimeText: item.submit_time ? this.formatDateTime(item.submit_time) : '刚刚提交',
      descriptionText: String(item.description || '').trim() || '本次提交未填写说明',
      materialText: `${imageCount} 张图片 / ${fileCount} 个附件`,
      feedbackText: String(item.feedback || '').trim(),
      scoreText: item.score === null || item.score === undefined ? '待评分' : `${Number(item.score)} 分`
    }
  },

  formatDateTime(value) {
    if (!value) {
      return '--'
    }

    return formatUtils.formatDate(value, 'YYYY-MM-DD HH:mm')
  },

  toRgba(hex, alpha) {
    const value = String(hex || '').replace('#', '')
    if (value.length !== 6) {
      return `rgba(31, 122, 224, ${alpha})`
    }

    const red = parseInt(value.slice(0, 2), 16)
    const green = parseInt(value.slice(2, 4), 16)
    const blue = parseInt(value.slice(4, 6), 16)

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  },

  onInputChange(e) {
    this.setData({
      'submitForm.description': String(e.detail.value || '').trimStart()
    })
  },

  onImageAdd(e) {
    const files = this.normalizeUploadEventFiles(e)
    if (!files.length) {
      return
    }

    const remainCount = this.data.imageMax - this.data.imageFiles.length
    if (remainCount <= 0) {
      Toast.showToast(`最多上传 ${this.data.imageMax} 张图片`)
      return
    }

    const pendingFiles = files
      .slice(0, remainCount)
      .map((item, index) => this.createPendingUploadFile(item, 'image', index))

    this.setData({
      imageFiles: this.data.imageFiles.concat(pendingFiles)
    }, () => {
      this.uploadSelectedFiles('imageFiles', 'submission-images', pendingFiles)
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
        this.uploadSelectedFiles('fileFiles', 'submission-files', pendingFiles)
      })
    } catch (error) {
      if (error && /cancel/i.test(String(error.errMsg || error.message || ''))) {
        return
      }
      console.error('[submission-edit] onSelectFiles error:', error)
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
      name: file.name || fileResource.getFileNameFromPath(file.url) || `${kind === 'image' ? '图片' : '附件'}${index + 1}`,
      sizeText: fileResource.formatFileSize(file.size),
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
          sizeText: fileResource.formatFileSize(file.size),
          file_name: file.name || fileResource.getFileNameFromPath(file.url)
        })
      } catch (error) {
        console.error('[submission-edit] uploadSelectedFiles error:', error)
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
    const extension = fileResource.getFileExtension(file.url || file.name)
    const fileName = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}${extension}`
    const date = new Date()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')

    return `submissions/${folder}/${date.getFullYear()}${month}${day}/${fileName}`
  },

  isAllowedAttachment(file = {}) {
    const name = file.name || fileResource.getFileNameFromPath(file.url)
    const extension = fileResource.getFileExtension(name).replace('.', '').toLowerCase()

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
      const previewResult = await fileResource.resolvePreviewFilePath(file)
      this.updateFilePreviewPath(file, previewResult.localPath)
      await fileResource.openDocument(previewResult.filePath)
      Toast.hideLoading()
    } catch (error) {
      console.error('[submission-edit] onPreviewFile error:', error)
      Toast.hideLoading()
      Toast.showToast('附件预览失败')
    }
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

  validateForm() {
    const description = String(this.data.submitForm.description || '').trim()
    const allUploadFiles = this.data.imageFiles.concat(this.data.fileFiles)

    if (!description && !this.data.imageFiles.length && !this.data.fileFiles.length) {
      Toast.showToast('请至少填写说明、上传图片或附件中的一项')
      return false
    }

    if (allUploadFiles.some((item) => item.status === 'loading')) {
      Toast.showToast('素材上传中，请稍后再提交')
      return false
    }

    if (allUploadFiles.some((item) => item.status === 'failed')) {
      Toast.showToast('存在上传失败的素材，请移除后重试')
      return false
    }

    return true
  },

  buildPayload() {
    return {
      task_id: this.data.taskId,
      description: String(this.data.submitForm.description || '').trim(),
      images: this.data.imageFiles
        .filter((item) => item.status === 'done' && item.file_id)
        .map((item) => item.file_id),
      files: this.data.fileFiles
        .filter((item) => item.status === 'done' && item.file_id)
        .map((item) => ({
          file_id: item.file_id,
          file_name: item.file_name || item.name || fileResource.getFileNameFromPath(item.url),
          file_size: Number(item.size || 0)
        }))
    }
  },

  async onSubmit() {
    if (this.data.saving || !this.validateForm()) {
      return
    }

    this.setData({
      saving: true
    })

    try {
      await TaskService.submitTask(this.buildPayload())
      await Toast.showSuccess('任务提交成功', 1800)

      setTimeout(() => {
        if (getCurrentPages().length > 1) {
          wx.navigateBack()
          return
        }

        wx.redirectTo({
          url: `/pages/student/task-manage/task-detail/task-detail?task_id=${this.data.taskId}`
        })
      }, 700)
    } catch (error) {
      console.error('[submission-edit] onSubmit error:', error)
      Toast.showToast(error.message || '提交失败')
    } finally {
      this.setData({
        saving: false
      })
    }
  },

  goToRecords() {
    wx.navigateTo({
      url: `/pages/student/task-manage/submission-records/submission-records?task_id=${this.data.taskId}`
    })
  }
})
