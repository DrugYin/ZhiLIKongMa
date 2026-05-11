const TaskService = require('../../../../services/task')
const Toast = require('../../../../utils/toast')
const formatUtils = require('../../../../utils/format')
const fileResource = require('../../../../utils/file-resource')
const {
  SUBMISSION_STATUS_TEXT,
  SUBMISSION_STATUS_COLOR
} = require('../../../../utils/constant')

Page({
  data: {
    pageTitle: '提交记录',
    taskId: '',
    isAllRecords: false,
    loading: true,
    loadingMore: false,
    popupVisible: false,
    popupLoading: false,
    taskInfo: null,
    records: [],
    popupRecord: null,
    popupRecordDetail: {
      imageList: [],
      imagePreviewUrls: [],
      attachmentFiles: [],
      feedbackImageList: [],
      feedbackImagePreviewUrls: [],
      feedbackAttachmentFiles: []
    },
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: false,
    stats: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    }
  },

  onLoad(options) {
    const taskId = String(options.task_id || '').trim()

    this.setData({
      taskId,
      isAllRecords: !taskId,
      pageTitle: taskId ? '提交记录' : '总提交记录'
    })

    this.initPage()
  },

  onShow() {
    if (this._pageReady) {
      this.initPage({ silent: true })
    }
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true })
  },

  async initPage({ silent = false, refreshing = false } = {}) {
    if (!silent && !refreshing) {
      Toast.showLoading('提交记录加载中...')
    }

    if (!silent && !refreshing) {
      this.setData({
        loading: true,
        page: 1
      })
    }

    try {
      const requestParams = this.buildSubmissionParams({
        page: 1,
        page_size: this.data.pageSize
      })

      const [taskInfo, submissionRes, stats] = await Promise.all([
        this.data.taskId ? TaskService.getTaskDetail(this.data.taskId) : Promise.resolve(null),
        TaskService.getSubmissions(requestParams),
        this.loadStats()
      ])

      const records = this.formatSubmissionList(submissionRes.list)
      this.setData({
        taskInfo: taskInfo ? this.formatTaskInfo(taskInfo) : null,
        records,
        total: stats.total,
        hasMore: Boolean(submissionRes.has_more),
        stats
      })
      this._pageReady = true
    } catch (error) {
      console.error('[submission-records] initPage error:', error)
      Toast.showToast(error.message || '提交记录加载失败')
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
        : '公开任务'
    }
  },

  formatSubmissionList(list = []) {
    return (Array.isArray(list) ? list : []).map((item) => this.formatSubmissionItem(item))
  },

  formatSubmissionItem(item = {}) {
    const status = item.status || 'pending'
    const statusColor = SUBMISSION_STATUS_COLOR[status] || '#faad14'
    const imageCount = Array.isArray(item.images) ? item.images.length : 0
    const fileCount = Array.isArray(item.files) ? item.files.length : 0
    const feedbackImageCount = Array.isArray(item.feedback_images) ? item.feedback_images.length : 0
    const feedbackFileCount = Array.isArray(item.feedback_files) ? item.feedback_files.length : 0
    const submitNo = Number(item.submit_no || 0)
    const pointsValue = Number(item.points_earned || 0)
    let pointsText = '待发放'

    if (status === 'approved') {
      pointsText = `${pointsValue} 积分`
    } else if (status === 'rejected') {
      pointsText = '0 积分'
    }

    return {
      ...item,
      submitNoText: submitNo || '--',
      taskTitle: item.task_title || '未命名任务',
      projectText: item.project_name || item.project_code || '未设置项目',
      classText: item.class_name || '未设置班级',
      statusText: SUBMISSION_STATUS_TEXT[status] || '待处理',
      statusStyle: `color:${statusColor};background:${this.toRgba(statusColor, 0.12)};`,
      submitTimeText: item.submit_time ? this.formatDateTime(item.submit_time) : '刚刚提交',
      descriptionText: String(item.description || '').trim() || '本次提交未填写说明',
      materialText: `${imageCount} 张图片 / ${fileCount} 个附件`,
      feedbackText: String(item.feedback || '').trim(),
      pointsText,
      overtimeText: item.is_overtime ? '已超截止时间提交' : '按时提交',
      imageCount,
      fileCount,
      feedbackImageCount,
      feedbackFileCount
    }
  },

  buildSubmissionParams(extra = {}) {
    const params = { ...extra }

    if (this.data.taskId) {
      params.task_id = this.data.taskId
    }

    return params
  },

  async loadStats() {
    const baseParams = this.buildSubmissionParams({
      page: 1,
      page_size: 1,
      count_only: true
    })

    const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      TaskService.getSubmissions({ ...baseParams }),
      TaskService.getSubmissions({ ...baseParams, status: 'pending' }),
      TaskService.getSubmissions({ ...baseParams, status: 'approved' }),
      TaskService.getSubmissions({ ...baseParams, status: 'rejected' })
    ])

    return {
      total: Number(totalRes.total || 0),
      pending: Number(pendingRes.total || 0),
      approved: Number(approvedRes.total || 0),
      rejected: Number(rejectedRes.total || 0)
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

  async onLoadMore() {
    if (this.data.loadingMore || !this.data.hasMore) {
      return
    }

    const nextPage = this.data.page + 1

    this.setData({
      loadingMore: true
    })

    try {
      const requestParams = this.buildSubmissionParams({
        page: nextPage,
        page_size: this.data.pageSize
      })

      const submissionRes = await TaskService.getSubmissions(requestParams)
      const records = this.data.records.concat(this.formatSubmissionList(submissionRes.list))

      this.setData({
        page: nextPage,
        records,
        total: Number(submissionRes.total || 0),
        hasMore: Boolean(submissionRes.has_more)
      })
    } catch (error) {
      console.error('[submission-records] onLoadMore error:', error)
      Toast.showToast(error.message || '加载更多失败')
    } finally {
      this.setData({
        loadingMore: false
      })
    }
  },

  async openRecordPopup(e) {
    const { index } = e.currentTarget.dataset
    const record = this.data.records[Number(index)]

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
        attachmentFiles: [],
        feedbackImageList: [],
        feedbackImagePreviewUrls: [],
        feedbackAttachmentFiles: []
      }
    })

    try {
      const [imageInfo, attachmentFiles, feedbackImageInfo, feedbackAttachmentFiles] = await Promise.all([
        fileResource.buildImagePreviewData(record.images),
        fileResource.buildAttachmentPreviewFiles(record.files),
        fileResource.buildImagePreviewData(record.feedback_images),
        fileResource.buildAttachmentPreviewFiles(record.feedback_files)
      ])

      this.setData({
        popupRecordDetail: {
          imageList: imageInfo.imageList,
          imagePreviewUrls: imageInfo.previewUrls,
          attachmentFiles,
          feedbackImageList: feedbackImageInfo.imageList,
          feedbackImagePreviewUrls: feedbackImageInfo.previewUrls,
          feedbackAttachmentFiles
        }
      })
    } catch (error) {
      console.error('[submission-records] openRecordPopup error:', error)
      Toast.showToast('提交详情加载失败')
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
      }
    })
  },

  onPreviewPopupImage(e) {
    const { index, type } = e.currentTarget.dataset
    const urls = type === 'feedback'
      ? this.data.popupRecordDetail.feedbackImagePreviewUrls
      : this.data.popupRecordDetail.imagePreviewUrls
    fileResource.previewImages(urls, index)
  },

  async onPreviewPopupFile(e) {
    const { index, type } = e.currentTarget.dataset
    const field = type === 'feedback'
      ? 'popupRecordDetail.feedbackAttachmentFiles'
      : 'popupRecordDetail.attachmentFiles'
    const sourceFiles = type === 'feedback'
      ? this.data.popupRecordDetail.feedbackAttachmentFiles
      : this.data.popupRecordDetail.attachmentFiles
    const file = sourceFiles[Number(index)]

    if (!file) {
      return
    }

    Toast.showLoading('正在打开附件...')

    try {
      const previewResult = await fileResource.resolvePreviewFilePath(file)
      this.setData({
        [field]: fileResource.updateFileLocalPath(sourceFiles, file, previewResult.localPath)
      })
      await fileResource.openDocument(previewResult.filePath)
      Toast.hideLoading()
    } catch (error) {
      console.error('[submission-records] onPreviewPopupFile error:', error)
      Toast.hideLoading()
      Toast.showToast('附件预览失败')
    }
  },

  goToSubmit() {
    wx.navigateTo({
      url: `/pages/student/task-manage/submission-edit/submission-edit?task_id=${this.data.taskId}`
    })
  },

  handleHeroAction() {
    if (this.data.isAllRecords) {
      this.goToTaskCenter()
      return
    }

    this.goToSubmit()
  },

  handleEmptyAction() {
    if (this.data.isAllRecords) {
      this.goToTaskCenter()
      return
    }

    this.goToSubmit()
  },

  goToTaskCenter() {
    wx.navigateTo({
      url: '/pages/student/task-manage/task-manage'
    })
  }
})
