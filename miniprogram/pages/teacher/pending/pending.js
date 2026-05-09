const TaskService = require('../../../services/task')
const ClassService = require('../../../services/class')
const { uploadFile } = require('../../../services/api')
const Toast = require('../../../utils/toast')
const formatUtils = require('../../../utils/format')
const fileResource = require('../../../utils/file-resource')
const {
  IMAGE_MAX_COUNT,
  IMAGE_MAX_SIZE,
  FILE_MAX_COUNT,
  FILE_MAX_SIZE,
  FILE_ALLOWED_TYPES
} = require('../../../utils/constant')

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
  width: 184,
  height: 184
}

const STATUS_TEXT_MAP = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回'
}

const REVIEW_ACTION_TEXT = {
  approved: {
    title: '确认通过',
    success: '已通过',
    feedback: '作业完成的很好，继续保持！'
  },
  rejected: {
    title: '确认驳回',
    success: '已驳回',
    feedback: '当前提交未通过，请补充说明或附件后再次提交。'
  }
}

Page({
  data: {
    loading: true,
    scrollTop: 0,
    processingId: '',
    popupVisible: false,
    popupLoading: false,
    typeFilter: 'all',
    statusFilter: 'all',
    classFilter: 'all',
    typeOptions: [
      { value: 'all', label: '全部待办' },
      { value: 'submission', label: '任务提交' },
      { value: 'application', label: '入班申请' }
    ],
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending', label: '待审核' },
      { value: 'processed', label: '已处理' }
    ],
    classOptions: [
      { value: 'all', label: '全部班级' }
    ],
    records: [],
    displayRecords: [],
    stats: {
      total: 0,
      pending: 0,
      taskPending: 0,
      joinPending: 0,
      approved: 0,
      rejected: 0
    },
    popupRecord: null,
    popupRecordDetail: {
      imageList: [],
      imagePreviewUrls: [],
      attachmentFiles: [],
      feedbackImageList: [],
      feedbackImagePreviewUrls: [],
      feedbackAttachmentFiles: []
    },
    reviewImageFiles: [],
    reviewFileFiles: [],
    imageUploadConfig: IMAGE_UPLOAD_CONFIG,
    imageSizeLimit: IMAGE_SIZE_LIMIT,
    fileSizeLimit: FILE_SIZE_LIMIT,
    imageGridConfig: IMAGE_GRID_CONFIG,
    imageMediaType: ['image'],
    reviewImageMax: IMAGE_MAX_COUNT.SUBMISSION,
    reviewFileMax: FILE_MAX_COUNT,
    fileAcceptText: FILE_ALLOWED_TYPES.join(' / '),
    reviewForm: {
      score: '',
      points: '',
      feedback: ''
    },
    reviewingApplicationId: '',
    reviewAction: '',
    page: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false,
    teacherClasses: [],
    totalSubmissionsFromBackend: 0,
    totalApplicationsFromBackend: 0
  },

  onLoad(options = {}) {
    this._routeHint = this.normalizeRouteHint(options)
    this.initPage()
    this._observer = this.createIntersectionObserver()
    this._observer.relativeToViewport({ top: 0 }).observe('#back-top-sentinel', (res) => {
      this.setData({ backTopVisible: res.intersectionRatio < 1 })
    })
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
      tabBar.init('/pages/teacher/pending/pending')
    }

    const storedHint = this.consumeStoredRouteHint()
    if (storedHint) {
      this._routeHint = storedHint
      if (this._pageReady) {
        this.initPage({ silent: true })
      }
      return
    }

    if (this._pageReady) {
      this.initPage({ silent: true })
    }
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true })
  },

  async initPage({ silent = false, refreshing = false } = {}) {
    if (!silent && !refreshing) {
      Toast.showLoading('审核记录加载中...')
    }

    this.setData({
      loading: true
    })

    try {
      const teacherClasses = await this.loadTeacherClasses()
      const classNames = teacherClasses
        .map((c) => c.class_name)
        .filter(Boolean)
      const classOptions = [{ value: 'all', label: '全部班级' }]
        .concat([...new Set(classNames)].map((name) => ({ value: name, label: name })))

      this.setData({
        teacherClasses,
        classOptions,
        page: 1,
        hasMore: true,
        records: []
      })

      await this.loadNextPage()
      this.loadStats()
      this.applyRouteHint()
      this._pageReady = true
    } catch (error) {
      console.error('[teacher-pending] initPage error:', error)
      Toast.showToast(error.message || '审核记录加载失败')
    } finally {
      this.setData({
        loading: false
      })

      if (!silent && !refreshing) {
        Toast.hideLoading()
      }

      wx.stopPullDownRefresh()
    }
  },

  async loadNextPage() {
    if (this.data.loadingMore) return
    if (!this.data.hasMore) return

    this.setData({ loadingMore: true })

    try {
      const promises = []

      const subParams = {
        role: 'teacher',
        page: this.data.page,
        page_size: this.data.pageSize
      }

      promises.push(
        TaskService.getSubmissions(subParams)
          .then((r) => ({ type: 'submissions', list: r.list || [], has_more: Boolean(r.has_more), total: r.total || 0 }))
          .catch((e) => {
            console.error('[pending] submissions error:', e)
            return { type: 'submissions', list: [], has_more: false, total: 0 }
          })
      )

      const appPromises = this.data.teacherClasses.map((classInfo) => {
        return ClassService.getClassApplications({
          class_id: classInfo._id,
          status: 'all',
          page: this.data.page,
          page_size: this.data.pageSize
        })
          .then((r) => ({
            classId: classInfo._id,
            className: classInfo.class_name,
            list: (r.list || []).map((item) => this.formatApplicationRecord(item, classInfo)),
            has_more: Boolean(r.has_more),
            total: r.total || 0
          }))
          .catch((e) => {
            console.error(`[pending] applications error for class ${classInfo._id}:`, e)
            return { classId: classInfo._id, className: classInfo.class_name, list: [], has_more: false, total: 0 }
          })
      })

      promises.push(
        Promise.all(appPromises).then((results) => ({ type: 'applications', results }))
      )

      const [subResult, appResult] = await Promise.all(promises)

      const newSubmissions = subResult.list.map((item) => this.formatRecord(item))

      const newApplications = []
      let anyAppHasMore = false
      let totalApplicationsFromBackend = 0

      if (appResult.results) {
        appResult.results.forEach(({ list, has_more, total }) => {
          newApplications.push(...list)
          if (has_more) anyAppHasMore = true
          totalApplicationsFromBackend += total
        })
      }

      const existingIds = new Set(this.data.records.map((r) => r.id))
      const combined = [...newSubmissions, ...newApplications]
        .filter((r) => !existingIds.has(r.id))
        .sort((a, b) => Number(b.sortTimestamp || 0) - Number(a.sortTimestamp || 0))

      const nextHasMore = subResult.has_more || anyAppHasMore
      const totalSubmissionsFromBackend = this.data.page === 1 ? subResult.total : this.data.totalSubmissionsFromBackend

      this.setData({
        records: [...this.data.records, ...combined],
        page: this.data.page + 1,
        hasMore: nextHasMore,
        totalSubmissionsFromBackend,
        totalApplicationsFromBackend: this.data.page === 1 ? totalApplicationsFromBackend : this.data.totalApplicationsFromBackend
      })
      this.applyFilters()
    } catch (error) {
      console.error('[teacher-pending] loadNextPage error:', error)
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  onScrollToLower() {
    this.loadNextPage()
  },

  onBackToTop() {
    this.setData({ scrollTop: 99999 }, () => {
      this.setData({ scrollTop: 0 })
    })
  },

  async loadTeacherClasses() {
    const result = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await ClassService.getClasses({
        role: 'teacher',
        page,
        page_size: 50,
        sort_by: 'update_time',
        sort_order: 'desc'
      })
      const list = Array.isArray(response.list) ? response.list : []

      result.push(...list)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return result
  },

  async loadStats() {
    try {
      const submissionParams = {
        role: 'teacher',
        page: 1,
        page_size: 1,
        count_only: true
      }

      const appPromises = this.data.teacherClasses.map((classInfo) => {
        return ClassService.getClassApplications({
          class_id: classInfo._id,
          status: 'all',
          page: 1,
          page_size: 1,
          count_only: true
        }).then((r) => r.total || 0).catch(() => 0)
      })

      const [totalSubRes, pendingSubRes, approvedSubRes, rejectedSubRes, ...appCounts] = await Promise.all([
        TaskService.getSubmissions({ ...submissionParams }),
        TaskService.getSubmissions({ ...submissionParams, status: 'pending' }),
        TaskService.getSubmissions({ ...submissionParams, status: 'approved' }),
        TaskService.getSubmissions({ ...submissionParams, status: 'rejected' }),
        ...appPromises
      ])

      const totalApplications = appCounts.reduce((sum, count) => sum + count, 0)

      this.setData({
        totalSubmissionsFromBackend: totalSubRes.total || 0,
        totalApplicationsFromBackend: totalApplications,
        stats: {
          ...this.data.stats,
          total: (totalSubRes.total || 0) + totalApplications,
          pending: (pendingSubRes.total || 0) + totalApplications,
          taskPending: pendingSubRes.total || 0,
          joinPending: totalApplications,
          approved: approvedSubRes.total || 0,
          rejected: rejectedSubRes.total || 0
        }
      })
    } catch (error) {
      console.error('[teacher-pending] loadStats error:', error)
    }
  },

  formatRecord(item = {}) {
    const status = item.status || 'pending'
    const imageCount = Array.isArray(item.images) ? item.images.length : 0
    const fileCount = Array.isArray(item.files) ? item.files.length : 0
    const feedbackImageCount = Array.isArray(item.feedback_images) ? item.feedback_images.length : 0
    const feedbackFileCount = Array.isArray(item.feedback_files) ? item.feedback_files.length : 0
    const summary = String(item.description || '').trim()
    const feedback = String(item.feedback || '').trim()

    return {
      ...item,
      id: item._id,
      rawId: item._id,
      recordKey: `submission-${item._id}`,
      recordType: 'submission',
      studentName: item.student_name || '未命名学生',
      className: item.class_name || '未分班',
      taskTitle: item.task_title || '未命名任务',
      taskId: item.task_id || '',
      taskPoints: Number(item.task_points || item.points || 0),
      projectText: item.project_name || item.project_code || '未设置项目',
      status,
      statusText: STATUS_TEXT_MAP[status] || '待处理',
      descriptionText: summary || '学生未填写提交说明。',
      summary: summary || (status === 'pending' ? '学生未填写提交说明。' : (feedback || '该提交已完成审核。')),
      feedbackText: feedback,
      submittedAt: item.submit_time ? this.formatDateTime(item.submit_time) : '刚刚提交',
      reviewedAt: item.review_time ? this.formatDateTime(item.review_time) : '待审核',
      attachmentText: `${imageCount} 张图片 · ${fileCount} 个附件`,
      scoreText: item.score === null || item.score === undefined ? '待评分' : `${Number(item.score)} 分`,
      pointsText: `${Number(item.points_earned || 0)} 分`,
      overtimeText: item.is_overtime ? '超时提交' : '按时提交',
      typeText: '任务提交',
      imageCount,
      fileCount,
      feedbackImageCount,
      feedbackFileCount,
      feedbackAttachmentText: `${feedbackImageCount} 张图片 · ${feedbackFileCount} 个附件`,
      sortTimestamp: new Date(item.submit_time || item.update_time || item.create_time || 0).getTime()
    }
  },

  formatApplicationRecord(item = {}, classInfo = {}) {
    const displayName = item.student_name || item.student_user_name || item.student_nick_name || '未命名学生'
    const createTime = item.create_time || item.update_time || null
    const status = item.status || 'pending'
    const reviewRemark = String(item.review_remark || '').trim()

    return {
      ...item,
      id: item._id,
      rawId: item._id,
      recordKey: `application-${item._id}`,
      recordType: 'application',
      studentName: displayName,
      className: item.class_name || classInfo.class_name || '未命名班级',
      classId: item.class_id || classInfo._id || '',
      taskTitle: '班级加入申请',
      taskId: '',
      taskPoints: 0,
      projectText: classInfo.project_name || classInfo.project_code || '未设置项目',
      status,
      statusText: STATUS_TEXT_MAP[status] || '待审核',
      descriptionText: String(item.apply_reason || '').trim() || '未填写申请理由',
      summary: `${displayName} 申请加入该班级`,
      feedbackText: reviewRemark,
      submittedAt: createTime ? this.formatDateTime(createTime) : '刚刚提交',
      reviewedAt: item.review_time ? this.formatDateTime(item.review_time) : '待审核',
      attachmentText: '无需提交材料',
      scoreText: '不适用',
      pointsText: '不适用',
      overtimeText: '',
      typeText: '入班申请',
      imageCount: 0,
      fileCount: 0,
      feedbackImageCount: 0,
      feedbackFileCount: 0,
      feedbackAttachmentText: '0 张图片 · 0 个附件',
      avatar: item.student_avatar || '/assets/default-avatar.png',
      gradeText: item.student_grade || '未填写年级',
      phoneText: formatUtils.formatPhone(item.student_phone) || '未填写电话',
      createTimeText: createTime ? this.formatDateTime(createTime) : '刚刚提交',
      relativeTimeText: createTime ? formatUtils.formatRelativeTime(createTime) : '刚刚',
      sortTimestamp: new Date(createTime || 0).getTime()
    }
  },

  applyFilters() {
    const { records, typeFilter, statusFilter, classFilter } = this.data
    const submissionRecords = records.filter((item) => item.recordType === 'submission')
    const applicationRecords = records.filter((item) => item.recordType === 'application')
    const displayRecords = records.filter((item) => {
      const matchedType = typeFilter === 'all' ? true : item.recordType === typeFilter
      const matchedStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'processed'
          ? item.status !== 'pending'
          : item.status === statusFilter
      const matchedClass = classFilter === 'all' ? true : item.className === classFilter
      return matchedType && matchedStatus && matchedClass
    })

    const totalFromBackend = (this.data.totalSubmissionsFromBackend || 0) + (this.data.totalApplicationsFromBackend || 0)

    this.setData({
      displayRecords,
      stats: {
        total: totalFromBackend || records.length,
        pending: records.filter((item) => item.status === 'pending').length,
        taskPending: submissionRecords.filter((item) => item.status === 'pending').length,
        joinPending: applicationRecords.filter((item) => item.status === 'pending').length,
        approved: records.filter((item) => item.status === 'approved').length,
        rejected: records.filter((item) => item.status === 'rejected').length
      }
    })
  },

  applyRouteHint() {
    const hint = this._routeHint
    if (!hint || hint.consumed) {
      return
    }

    if (hint.type === 'submission') {
      const record = this.data.records.find((item) => item.recordType === 'submission' && item.id === hint.recordId)
      this._routeHint.consumed = true
      this.setData({
        typeFilter: 'submission',
        statusFilter: 'all',
        classFilter: 'all'
      }, () => {
        this.applyFilters()
        if (record) {
          setTimeout(() => {
            this.openRecordById(record.id)
          }, 80)
        }
      })
      return
    }

    if (hint.type === 'application') {
      const record = this.data.records.find((item) => item.recordType === 'application' && item.id === hint.recordId)
      this._routeHint.consumed = true
      this.setData({
        typeFilter: 'application',
        statusFilter: 'all',
        classFilter: record && record.className ? record.className : 'all'
      }, () => {
        this.applyFilters()
      })
    }
  },

  normalizeRouteHint(options = {}) {
    const type = String(options.type || '').trim()
    const recordId = String(options.record_id || options.recordId || options.id || '').trim()

    if (!type && !recordId) {
      return null
    }

    return {
      type,
      recordId,
      consumed: false
    }
  },

  consumeStoredRouteHint() {
    try {
      const hint = wx.getStorageSync('teacher_pending_route_hint')
      if (!hint) {
        return null
      }

      wx.removeStorageSync('teacher_pending_route_hint')
      return this.normalizeRouteHint(hint)
    } catch (error) {
      console.error('[teacher-pending] consumeStoredRouteHint error:', error)
      return null
    }
  },

  formatDateTime(value) {
    if (!value) {
      return '--'
    }

    return formatUtils.formatDate(value, 'YYYY-MM-DD HH:mm')
  },

  onStatusFilterChange(e) {
    const { value } = e.currentTarget.dataset
    this.setData(
      {
        statusFilter: value
      },
      () => {
        this.initPage({ silent: true })
      }
    )
  },

  onTypeFilterChange(e) {
    const { value } = e.currentTarget.dataset
    this.setData(
      {
        typeFilter: value
      },
      () => {
        this.initPage({ silent: true })
      }
    )
  },

  onClassFilterChange(e) {
    const { value } = e.currentTarget.dataset
    this.setData(
      {
        classFilter: value
      },
      () => {
        this.initPage({ silent: true })
      }
    )
  },

  async openRecordPopup(e) {
    const { id } = e.currentTarget.dataset
    this.openRecordById(id)
  },

  async openRecordById(id) {
    const record = this.data.records.find((item) => item.id === id)

    if (!record || record.recordType !== 'submission') {
      return
    }

    this.setData({
      popupVisible: true,
      popupLoading: true,
      popupRecord: record,
      popupRecordDetail: {
        imageList: [],
        imagePreviewUrls: [],
        attachmentFiles: [],
        feedbackImageList: [],
        feedbackImagePreviewUrls: [],
        feedbackAttachmentFiles: []
      },
      reviewImageFiles: [],
      reviewFileFiles: [],
      reviewForm: {
        score: record.score === null || record.score === undefined ? '' : `${Number(record.score)}`,
        points: record.status === 'pending'
          ? `${Math.max(Number(record.taskPoints || 0), 0)}`
          : `${Number(record.points_earned || 0)}`,
        feedback: record.feedbackText || (record.status === 'pending'
          ? ''
          : (REVIEW_ACTION_TEXT[record.status] && REVIEW_ACTION_TEXT[record.status].feedback) || '')
      }
    })

    try {
      const [imageInfo, attachmentFiles, feedbackImageInfo, feedbackAttachmentFiles, taskInfo] = await Promise.all([
        fileResource.buildImagePreviewData(record.images),
        fileResource.buildAttachmentPreviewFiles(record.files),
        fileResource.buildImagePreviewData(record.feedback_images),
        fileResource.buildAttachmentPreviewFiles(record.feedback_files),
        record.taskId ? TaskService.getTaskDetail(record.taskId).catch(() => null) : Promise.resolve(null)
      ])

      const taskPoints = taskInfo ? Number(taskInfo.points || 0) : Math.max(Number(record.taskPoints || 0), 0)
      const nextRecord = {
        ...record,
        taskPoints
      }

      this.setData({
        popupRecord: nextRecord,
        popupRecordDetail: {
          imageList: imageInfo.imageList,
          imagePreviewUrls: imageInfo.previewUrls,
          attachmentFiles,
          feedbackImageList: feedbackImageInfo.imageList,
          feedbackImagePreviewUrls: feedbackImageInfo.previewUrls,
          feedbackAttachmentFiles
        },
        reviewImageFiles: record.status === 'pending'
          ? []
          : feedbackImageInfo.imageList.map((item) => ({
              ...item,
              percent: 100,
              status: 'done',
              file_id: item.fileId,
              file_name: item.name
            })),
        reviewFileFiles: record.status === 'pending' ? [] : feedbackAttachmentFiles,
        'reviewForm.points': record.status === 'pending'
          ? `${taskPoints}`
          : `${Number(record.points_earned || 0)}`
      })
    } catch (error) {
      console.error('[teacher-pending] openRecordPopup error:', error)
      Toast.showToast('提交素材加载失败')
    } finally {
      this.setData({
        popupLoading: false
      })
    }
  },

  onPopupVisibleChange(e) {
    const visible = Boolean(e.detail && e.detail.visible)

    if (!visible) {
      this.closePopup()
    }
  },

  closePopup() {
    this.setData({
      popupVisible: false,
      popupLoading: false,
      popupRecord: null,
      popupRecordDetail: {
        imageList: [],
        imagePreviewUrls: [],
        attachmentFiles: [],
        feedbackImageList: [],
        feedbackImagePreviewUrls: [],
        feedbackAttachmentFiles: []
      },
      reviewImageFiles: [],
      reviewFileFiles: [],
      reviewForm: {
        score: '',
        points: '',
        feedback: ''
      }
    })
  },

  onReviewFieldChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail && e.detail.value !== undefined
      ? e.detail.value
      : (e.detail !== undefined ? e.detail : '')

    this.setData({
      [`reviewForm.${field}`]: typeof value === 'string' ? value : String(value)
    })
  },

  onPreviewPopupImage(e) {
    const { index } = e.currentTarget.dataset
    fileResource.previewImages(this.data.popupRecordDetail.imagePreviewUrls, index)
  },

  onPreviewFeedbackImage(e) {
    const { index } = e.currentTarget.dataset
    fileResource.previewImages(this.data.popupRecordDetail.feedbackImagePreviewUrls, index)
  },

  async onPreviewPopupFile(e) {
    const { index } = e.currentTarget.dataset
    const file = this.data.popupRecordDetail.attachmentFiles[Number(index)]

    if (!file) {
      return
    }

    Toast.showLoading('正在打开附件...')

    try {
      const previewResult = await fileResource.resolvePreviewFilePath(file)
      this.updatePopupFileLocalPath(file, previewResult.localPath)
      await fileResource.openDocument(previewResult.filePath)
      Toast.hideLoading()
    } catch (error) {
      console.error('[teacher-pending] onPreviewPopupFile error:', error)
      Toast.hideLoading()
      Toast.showToast('附件预览失败')
    }
  },

  updatePopupFileLocalPath(file, localPath) {
    this.setData({
      'popupRecordDetail.attachmentFiles': fileResource.updateFileLocalPath(
        this.data.popupRecordDetail.attachmentFiles,
        file,
        localPath
      )
    })
  },

  async onPreviewFeedbackFile(e) {
    const { index } = e.currentTarget.dataset
    const file = this.data.popupRecordDetail.feedbackAttachmentFiles[Number(index)]

    if (!file) {
      return
    }

    Toast.showLoading('正在打开附件...')

    try {
      const previewResult = await fileResource.resolvePreviewFilePath(file)
      this.updateFeedbackFileLocalPath(file, previewResult.localPath)
      await fileResource.openDocument(previewResult.filePath)
      Toast.hideLoading()
    } catch (error) {
      console.error('[teacher-pending] onPreviewFeedbackFile error:', error)
      Toast.hideLoading()
      Toast.showToast('反馈附件预览失败')
    }
  },

  updateFeedbackFileLocalPath(file, localPath) {
    this.setData({
      'popupRecordDetail.feedbackAttachmentFiles': fileResource.updateFileLocalPath(
        this.data.popupRecordDetail.feedbackAttachmentFiles,
        file,
        localPath
      ),
      reviewFileFiles: fileResource.updateFileLocalPath(
        this.data.reviewFileFiles,
        file,
        localPath
      )
    })
  },

  onReviewImageAdd(e) {
    const files = this.normalizeUploadEventFiles(e)
    if (!files.length) {
      return
    }

    const remainCount = this.data.reviewImageMax - this.data.reviewImageFiles.length
    if (remainCount <= 0) {
      Toast.showToast(`最多上传 ${this.data.reviewImageMax} 张图片`)
      return
    }

    const pendingFiles = files
      .slice(0, remainCount)
      .map((item, index) => this.createPendingUploadFile(item, 'image', index))

    this.setData({
      reviewImageFiles: this.data.reviewImageFiles.concat(pendingFiles)
    }, () => {
      this.uploadSelectedFiles('reviewImageFiles', 'review-images', pendingFiles)
    })
  },

  onReviewImageRemove(e) {
    const { index } = e.detail || {}
    this.removeUploadFileAt('reviewImageFiles', index)
  },

  async onSelectReviewFiles() {
    const remainCount = this.data.reviewFileMax - this.data.reviewFileFiles.length

    if (remainCount <= 0) {
      Toast.showToast(`最多上传 ${this.data.reviewFileMax} 个附件`)
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
        reviewFileFiles: this.data.reviewFileFiles.concat(pendingFiles)
      }, () => {
        this.uploadSelectedFiles('reviewFileFiles', 'review-files', pendingFiles)
      })
    } catch (error) {
      if (error && /cancel/i.test(String(error.errMsg || error.message || ''))) {
        return
      }
      console.error('[teacher-pending] onSelectReviewFiles error:', error)
      Toast.showToast('选择反馈附件失败')
    }
  },

  onDeleteReviewFile(e) {
    const { index } = e.currentTarget.dataset
    this.removeUploadFileAt('reviewFileFiles', Number(index))
  },

  async onPreviewReviewUploadFile(e) {
    const { index } = e.currentTarget.dataset
    const file = this.data.reviewFileFiles[Number(index)]

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
      this.updateReviewUploadFilePreviewPath(file, previewResult.localPath)
      await fileResource.openDocument(previewResult.filePath)
      Toast.hideLoading()
    } catch (error) {
      console.error('[teacher-pending] onPreviewReviewUploadFile error:', error)
      Toast.hideLoading()
      Toast.showToast('反馈附件预览失败')
    }
  },

  updateReviewUploadFilePreviewPath(file, localPath) {
    this.setData({
      reviewFileFiles: fileResource.updateFileLocalPath(this.data.reviewFileFiles, file, localPath)
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
        console.error('[teacher-pending] uploadSelectedFiles error:', error)
        failed.push({
          ...file,
          percent: 0,
          status: 'failed'
        })
      }
    }

    this.replaceUploadFiles(field, uploaded.concat(failed))

    if (failed.length) {
      Toast.showToast(`${failed.length} 个${field === 'reviewImageFiles' ? '图片' : '附件'}上传失败，可移除后重试`)
      return
    }

    if (uploaded.length) {
      Toast.showSuccess(`${uploaded.length} 个${field === 'reviewImageFiles' ? '图片' : '附件'}上传成功`, 1500)
    }
  },

  replaceUploadFiles(field, changedFiles) {
    const changedMap = changedFiles.reduce((result, item) => {
      if (item && item._uploadId) {
        result[item._uploadId] = item
      }
      return result
    }, {})

    this.setData({
      [field]: (this.data[field] || []).map((item) => changedMap[item._uploadId] || item)
    })
  },

  buildCloudPath(folder, file, index) {
    const extension = fileResource.getFileExtension(file.url || file.name)
    const fileName = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}${extension}`
    const date = new Date()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')

    return `reviews/${folder}/${date.getFullYear()}${month}${day}/${fileName}`
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

  isAllowedAttachment(file = {}) {
    const name = file.name || fileResource.getFileNameFromPath(file.url)
    const extension = fileResource.getFileExtension(name).replace('.', '').toLowerCase()

    if (!extension) {
      return false
    }

    return FILE_ALLOWED_TYPES.includes(extension)
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

  getReviewFeedbackImagesPayload() {
    return this.data.reviewImageFiles
      .filter((item) => item.status === 'done' && item.file_id)
      .map((item) => item.file_id)
  },

  getReviewFeedbackFilesPayload() {
    return this.data.reviewFileFiles
      .filter((item) => item.status === 'done' && item.file_id)
      .map((item) => ({
        file_id: item.file_id,
        file_name: item.file_name || item.name || fileResource.getFileNameFromPath(item.url),
        file_size: Number(item.size || 0)
      }))
  },

  validateReviewForm(status) {
    const scoreText = String(this.data.reviewForm.score || '').trim()
    const pointsText = String(this.data.reviewForm.points || '').trim()
    const reviewUploads = this.data.reviewImageFiles.concat(this.data.reviewFileFiles)

    if (scoreText && (!Number.isFinite(Number(scoreText)) || Number(scoreText) < 0)) {
      Toast.showToast('评分需为大于等于 0 的数字')
      return false
    }

    if (pointsText && (!Number.isInteger(Number(pointsText)) || Number(pointsText) < 0)) {
      Toast.showToast('发放积分需为大于等于 0 的整数')
      return false
    }

    if (status === 'rejected' && !String(this.data.reviewForm.feedback || '').trim()) {
      Toast.showToast('驳回时请填写处理意见')
      return false
    }

    if (reviewUploads.some((item) => item.status === 'loading')) {
      Toast.showToast('反馈素材上传中，请稍后再提交审核')
      return false
    }

    if (reviewUploads.some((item) => item.status === 'failed')) {
      Toast.showToast('存在上传失败的反馈素材，请移除后重试')
      return false
    }

    return true
  },

  async handleReviewAction(status) {
    const record = this.data.popupRecord

    if (!record || !record.id || this.data.processingId || !this.validateReviewForm(status)) {
      return
    }

    const actionConfig = REVIEW_ACTION_TEXT[status]
    const pointsText = status === 'rejected'
      ? '0'
      : (String(this.data.reviewForm.points || '').trim() || '0')
    const confirmed = await Toast.confirm(
      `${status === 'approved' ? '通过' : '驳回'}后将发放 ${pointsText} 积分，确认继续吗？`,
      actionConfig.title
    )

    if (!confirmed) {
      return
    }

    this.setData({
      processingId: record.id
    })

    try {
      const reviewedRecord = await TaskService.reviewSubmission({
        submission_id: record.id,
        status,
        feedback: String(this.data.reviewForm.feedback || '').trim() || actionConfig.feedback,
        score: String(this.data.reviewForm.score || '').trim(),
        feedback_images: this.getReviewFeedbackImagesPayload(),
        feedback_files: this.getReviewFeedbackFilesPayload(),
        points_earned: status === 'rejected'
          ? '0'
          : String(this.data.reviewForm.points || '').trim()
      })

      const formattedRecord = this.formatRecord(reviewedRecord)
      const records = this.data.records.map((item) => (
        item.id === record.id ? formattedRecord : item
      ))

      this.setData({
        records,
        popupRecord: formattedRecord
      }, () => {
        this.applyFilters()
      })

      Toast.showSuccess(actionConfig.success, 1500)
      this.closePopup()
    } catch (error) {
      console.error('[teacher-pending] handleReviewAction error:', error)
      Toast.showToast(error.message || '审核操作失败')
    } finally {
      this.setData({
        processingId: ''
      })
    }
  },

  handleApprove() {
    this.handleReviewAction('approved')
  },

  handleReject() {
    this.handleReviewAction('rejected')
  },

  async onReviewClassApplication(e) {
    const { applicationId, action, studentName } = e.currentTarget.dataset

    if (!applicationId || !['approve', 'reject'].includes(action) || this.data.reviewingApplicationId) {
      return
    }

    const actionText = action === 'approve' ? '通过' : '拒绝'
    const confirmed = await Toast.confirm(`确认${actionText}“${studentName || '该学生'}”的入班申请吗？`)

    if (!confirmed) {
      return
    }

    this.setData({
      reviewingApplicationId: applicationId,
      reviewAction: action
    })
    Toast.showLoading(`正在${actionText}申请...`)

    try {
      await ClassService.handleApplication({
        application_id: applicationId,
        action
      })
      Toast.hideLoading()
      await Toast.showSuccess(`${actionText}成功`)
      await this.initPage({ silent: true })
    } catch (error) {
      console.error('[teacher-pending] onReviewClassApplication error:', error)
      Toast.hideLoading()
      Toast.showToast(error.message || `${actionText}申请失败`)
    } finally {
      this.setData({
        reviewingApplicationId: '',
        reviewAction: ''
      })
    }
  },

  goToTaskManage() {
    wx.switchTab({
      url: '/pages/teacher/task-manage/task-manage'
    })
  },

  onShareAppMessage() {
    return {
      title: '智力控码任务审核',
      path: '/pages/teacher/pending/pending'
    }
  }
})
