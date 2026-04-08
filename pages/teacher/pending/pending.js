const TaskService = require('../../../services/task')
const Toast = require('../../../utils/toast')
const formatUtils = require('../../../utils/format')
const fileResource = require('../../../utils/file-resource')

const STATUS_TEXT_MAP = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回'
}

const REVIEW_ACTION_TEXT = {
  approved: {
    title: '确认通过',
    success: '已通过',
    feedback: '审核通过，继续保持。'
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
    processingId: '',
    popupVisible: false,
    popupLoading: false,
    statusFilter: 'all',
    classFilter: 'all',
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
      approved: 0,
      rejected: 0
    },
    popupRecord: null,
    popupRecordDetail: {
      imageList: [],
      imagePreviewUrls: [],
      attachmentFiles: []
    },
    reviewForm: {
      score: '',
      points: '',
      feedback: ''
    }
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.changeData({ type: 'teacher' })
      tabBar.init('/pages/teacher/pending/pending')
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
      const records = await this.loadAllSubmissions()
      const classes = Array.from(new Set(records.map((item) => item.className).filter(Boolean)))

      this.setData({
        records,
        classOptions: [{ value: 'all', label: '全部班级' }].concat(
          classes.map((item) => ({
            value: item,
            label: item
          }))
        )
      })

      this.applyFilters()
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

  async loadAllSubmissions() {
    const result = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await TaskService.getSubmissions({
        role: 'teacher',
        page,
        page_size: 50
      })
      const list = Array.isArray(response.list) ? response.list : []

      result.push(...list.map((item) => this.formatRecord(item)))
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return result
  },

  formatRecord(item = {}) {
    const status = item.status || 'pending'
    const imageCount = Array.isArray(item.images) ? item.images.length : 0
    const fileCount = Array.isArray(item.files) ? item.files.length : 0
    const summary = String(item.description || '').trim()
    const feedback = String(item.feedback || '').trim()

    return {
      ...item,
      id: item._id,
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
      imageCount,
      fileCount
    }
  },

  applyFilters() {
    const { records, statusFilter, classFilter } = this.data
    const displayRecords = records.filter((item) => {
      const matchedStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'processed'
          ? item.status !== 'pending'
          : item.status === statusFilter
      const matchedClass = classFilter === 'all' ? true : item.className === classFilter
      return matchedStatus && matchedClass
    })

    this.setData({
      displayRecords,
      stats: {
        total: records.length,
        pending: records.filter((item) => item.status === 'pending').length,
        approved: records.filter((item) => item.status === 'approved').length,
        rejected: records.filter((item) => item.status === 'rejected').length
      }
    })
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
        this.applyFilters()
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
        this.applyFilters()
      }
    )
  },

  async openRecordPopup(e) {
    const { id } = e.currentTarget.dataset
    const record = this.data.records.find((item) => item.id === id)

    if (!record) {
      return
    }

    this.setData({
      popupVisible: true,
      popupLoading: true,
      popupRecord: record,
      popupRecordDetail: {
        imageList: [],
        imagePreviewUrls: [],
        attachmentFiles: []
      },
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
      const [imageInfo, attachmentFiles, taskInfo] = await Promise.all([
        fileResource.buildImagePreviewData(record.images),
        fileResource.buildAttachmentPreviewFiles(record.files),
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
          attachmentFiles
        },
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
        attachmentFiles: []
      },
      reviewForm: {
        score: '',
        points: '',
        feedback: ''
      }
    })
  },

  onReviewFieldChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail && e.detail.value !== undefined ? e.detail.value : ''

    this.setData({
      [`reviewForm.${field}`]: typeof value === 'string' ? value : String(value)
    })
  },

  onPreviewPopupImage(e) {
    const { index } = e.currentTarget.dataset
    fileResource.previewImages(this.data.popupRecordDetail.imagePreviewUrls, index)
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

  validateReviewForm(status) {
    const scoreText = String(this.data.reviewForm.score || '').trim()
    const pointsText = String(this.data.reviewForm.points || '').trim()

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
