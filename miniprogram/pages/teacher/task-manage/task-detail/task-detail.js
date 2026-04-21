const TaskService = require('../../../../services/task')
const ClassService = require('../../../../services/class')
const Toast = require('../../../../utils/toast')
const formatUtils = require('../../../../utils/format')
const fileResource = require('../../../../utils/file-resource')
const taskDeadline = require('../../../../utils/task-deadline')

const TASK_STATUS_TEXT = {
  draft: '草稿',
  published: '已发布',
  closed: '已关闭'
}

const TASK_STATUS_CLASS = {
  draft: 'status-draft',
  published: 'status-published',
  closed: 'status-closed'
}

const TASK_TYPE_TEXT = {
  public: '公开任务',
  class: '班级任务'
}

const VISIBILITY_TEXT = {
  public: '公开可见',
  class_only: '仅班级成员'
}

const DIFFICULTY_TEXT = {
  1: '入门',
  2: '基础',
  3: '进阶',
  4: '高级',
  5: '专家'
}

const DIFFICULTY_COLOR = {
  1: '#52c41a',
  2: '#1890ff',
  3: '#faad14',
  4: '#ff4d4f',
  5: '#8c55ff'
}

Page({
  data: {
    taskId: '',
    loading: true,
    taskInfo: null
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

  onShow() {
    if (this._pageReady) {
      this.initPage({ silent: true })
    }
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true })
  },

  async initPage({ refreshing = false, silent = false } = {}) {
    if (!silent && !refreshing) {
      Toast.showLoading('任务详情加载中...')
    }

    if(!silent) {
      this.setData({
        loading: true
      })
    }

    try {
      const rawTaskInfo = await TaskService.getTaskDetail(this.data.taskId)
      const progressStats = await this.loadTaskProgressStats(rawTaskInfo)
      const [imageInfo, attachmentFiles] = await Promise.all([
        fileResource.buildImagePreviewData(rawTaskInfo.images),
        fileResource.buildAttachmentPreviewFiles(rawTaskInfo.files)
      ])
      this.setData({
        taskInfo: this.formatTaskInfo({
          ...rawTaskInfo,
          progress_stats: progressStats,
          image_list: imageInfo.imageList,
          image_preview_urls: imageInfo.previewUrls,
          attachment_files: attachmentFiles
        })
      })
      this._pageReady = true
    } catch (error) {
      console.error('[task-detail] initPage error:', error)
      Toast.showToast(error.message || '任务详情加载失败')
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

  async loadTaskProgressStats(taskInfo = {}) {
    const submissions = await this.loadAllTaskSubmissions()
    const targetCount = await this.loadTaskTargetCount(taskInfo)
    const approvedList = submissions.filter((item) => item.status === 'approved')
    const pendingList = submissions.filter((item) => item.status === 'pending')
    const rejectedList = submissions.filter((item) => item.status === 'rejected')
    const submittedStudentSet = new Set(
      submissions
        .map((item) => item.student_openid)
        .filter(Boolean)
    )
    const lastSubmitTime = submissions.reduce((latest, item) => {
      const current = item.submit_time ? new Date(item.submit_time).getTime() : 0
      return current > latest ? current : latest
    }, 0)

    return {
      submission_count: submissions.length,
      passed_count: approvedList.length,
      pending_count: pendingList.length,
      rejected_count: rejectedList.length,
      target_count: typeof targetCount === 'number' ? targetCount : null,
      participant_count: submittedStudentSet.size,
      completion_rate: typeof targetCount === 'number' && targetCount > 0
        ? Math.round((submittedStudentSet.size / targetCount) * 100)
        : null,
      pass_rate: submissions.length > 0
        ? Math.round((approvedList.length / submissions.length) * 100)
        : 0,
      last_submit_time: lastSubmitTime || null
    }
  },

  async loadAllTaskSubmissions() {
    const result = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await TaskService.getSubmissions({
        role: 'teacher',
        task_id: this.data.taskId,
        page,
        page_size: 50
      })
      const list = Array.isArray(response.list) ? response.list : []

      result.push(...list)
      hasMore = Boolean(response.has_more)
      page += 1
    }

    return result
  },

  async loadTaskTargetCount(taskInfo = {}) {
    if (typeof taskInfo.target_count === 'number' && !Number.isNaN(taskInfo.target_count)) {
      return taskInfo.target_count
    }

    if (taskInfo.task_type === 'class' && taskInfo.class_id) {
      try {
        const classInfo = await ClassService.getClassDetail(taskInfo.class_id)
        const memberCount = Number(classInfo.member_count || 0)
        return Number.isNaN(memberCount) ? null : memberCount
      } catch (error) {
        console.error('[task-detail] loadTaskTargetCount error:', error)
      }
    }

    return null
  },

  formatTaskInfo(item = {}) {
    const difficulty = Number(item.difficulty || 0)
    const taskType = item.task_type || 'public'
    const visibility = taskType === 'public' ? 'public' : (item.visibility || 'class_only')
    const progressInfo = this.formatProgressInfo(item)

    return {
      ...item,
      titleText: item.title || '未命名任务',
      descriptionText: item.description || '暂无任务说明',
      projectText: item.project_name || item.project_code || '未设置项目',
      classText: taskType === 'class'
        ? (item.class_name || '未设置班级')
        : '面向全部学生',
      taskTypeText: TASK_TYPE_TEXT[taskType] || '未分类任务',
      visibilityText: VISIBILITY_TEXT[visibility] || '可见范围未设置',
      statusText: TASK_STATUS_TEXT[item.status] || '未知状态',
      statusClass: TASK_STATUS_CLASS[item.status] || 'status-draft',
      difficultyText: DIFFICULTY_TEXT[difficulty] || '未设置难度',
      difficultyStyle: `color:${DIFFICULTY_COLOR[difficulty] || '#6f7f91'};background:${this.toRgba(DIFFICULTY_COLOR[difficulty] || '#6f7f91', 0.12)};`,
      pointsText: `${Number(item.points || 0)} 分`,
      deadlineText: taskDeadline.formatTaskDeadline(item),
      publishTimeText: item.publish_time ? this.formatDateTime(item.publish_time) : '待发布',
      updateTimeText: item.update_time ? this.formatDateTime(item.update_time) : '待更新',
      createTimeText: item.create_time ? this.formatDateTime(item.create_time) : '待创建',
      imageCountText: `${Array.isArray(item.images) ? item.images.length : 0} 张图片`,
      imageList: Array.isArray(item.image_list) ? item.image_list : [],
      imagePreviewUrls: Array.isArray(item.image_preview_urls) ? item.image_preview_urls : [],
      fileCountText: `${Array.isArray(item.files) ? item.files.length : 0} 个附件`,
      attachmentFiles: Array.isArray(item.attachment_files) ? item.attachment_files : [],
      attachmentText: Array.isArray(item.files) && item.files.length
        ? item.files.map((file) => file.file_name || '未命名附件').join(' / ')
        : '暂无附件',
      progressInfo
    }
  },

  formatProgressInfo(item = {}) {
    const source = item.progress_stats || item.progress || item.completion_stats || {}
    const participantCount = this.getNumberValue(source, item, [
      'participant_count',
      'submitted_student_count',
      'unique_student_count'
    ])
    const submissionCount = this.getNumberValue(source, item, [
      'submission_count',
      'submit_count',
      'submitted_count',
      'total_submissions'
    ])
    const passedCount = this.getNumberValue(source, item, [
      'passed_count',
      'approved_count',
      'pass_count',
      'success_count'
    ])
    const pendingCount = this.getNumberValue(source, item, [
      'pending_count',
      'reviewing_count',
      'review_count'
    ])
    const rejectedCount = this.getNumberValue(source, item, [
      'rejected_count',
      'reject_count',
      'failed_count'
    ])
    const targetCount = this.getNumberValue(source, item, [
      'target_count',
      'participant_count',
      'student_count',
      'expected_submission_count'
    ])
    const completionRate = this.getRateValue(source, item, [
      'completion_rate',
      'submit_rate'
    ], participantCount, targetCount)
    const passRate = this.getRateValue(source, item, [
      'pass_rate',
      'approved_rate'
    ], passedCount, submissionCount)
    const lastSubmitTime = source.last_submit_time || source.last_submission_time || item.last_submit_time || item.last_submission_time
    const hasRealData = [
      submissionCount,
      passedCount,
      pendingCount,
      rejectedCount,
      targetCount
    ].some((value) => value !== null)

    return {
      submissionCountText: this.formatCountText(submissionCount),
      passedCountText: this.formatCountText(passedCount),
      pendingCountText: this.formatCountText(pendingCount),
      rejectedCountText: this.formatCountText(rejectedCount),
      targetCountText: this.formatTargetCountText(targetCount),
      completionRateText: this.formatRateText(completionRate),
      passRateText: this.formatRateText(passRate),
      completionPercent: completionRate,
      completionBarStyle: `width:${completionRate}%;`,
      lastSubmitTimeText: lastSubmitTime ? this.formatDateTime(lastSubmitTime) : '暂无提交',
      noteText: hasRealData
        ? this.buildProgressNoteText(targetCount, participantCount)
        : '已预留提交统计字段，后续接入任务提交接口后会自动展示。'
    }
  },

  buildProgressNoteText(targetCount, participantCount) {
    if (typeof targetCount === 'number' && targetCount > 0) {
      return `当前已有 ${typeof participantCount === 'number' ? participantCount : 0} 名学生提交，统计会随着审核结果自动刷新。`
    }

    return '当前已接入真实提交与审核数据，公开任务暂不统计目标参与人数。'
  },

  getNumberValue(primarySource, fallbackSource, keys = []) {
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      const value = primarySource[key]
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value
      }
    }

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      const value = fallbackSource[key]
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value
      }
    }

    return null
  },

  getRateValue(primarySource, fallbackSource, keys = [], numerator, denominator) {
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      const value = this.normalizeRate(primarySource[key])
      if (value !== null) {
        return value
      }
    }

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      const value = this.normalizeRate(fallbackSource[key])
      if (value !== null) {
        return value
      }
    }

    if (typeof numerator === 'number' && typeof denominator === 'number' && denominator > 0) {
      return this.clampPercent(Math.round((numerator / denominator) * 100))
    }

    return 0
  },

  normalizeRate(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null
    }

    if (value > 0 && value <= 1) {
      return this.clampPercent(Math.round(value * 100))
    }

    return this.clampPercent(Math.round(value))
  },

  clampPercent(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0
    }

    if (value < 0) {
      return 0
    }

    if (value > 100) {
      return 100
    }

    return value
  },

  formatCountText(value) {
    return typeof value === 'number' ? `${value}` : '待接入'
  },

  formatTargetCountText(value) {
    return typeof value === 'number' ? `${value}` : '未设定'
  },

  formatRateText(value) {
    return typeof value === 'number' ? `${value}%` : '待接入'
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

  onPreviewImage(e) {
    const { index } = e.currentTarget.dataset
    const { taskInfo } = this.data
    fileResource.previewImages(taskInfo && taskInfo.imagePreviewUrls, index)
  },

  async onPreviewFile(e) {
    const { index } = e.currentTarget.dataset
    const { taskInfo } = this.data
    const attachmentFiles = taskInfo && Array.isArray(taskInfo.attachmentFiles)
      ? taskInfo.attachmentFiles
      : []
    const file = attachmentFiles[Number(index)]

    if (!file) {
      return
    }

    Toast.showLoading('正在打开附件...')

    try {
      const previewResult = await fileResource.resolvePreviewFilePath(file)
      this.updateAttachmentLocalPath(file, previewResult.localPath)
      await fileResource.openDocument(previewResult.filePath)
      Toast.hideLoading()
    } catch (error) {
      console.error('[task-detail] onPreviewFile error:', error)
      Toast.hideLoading()
      Toast.showToast('附件预览失败')
    }
  },

  updateAttachmentLocalPath(file, localPath) {
    const { taskInfo } = this.data
    if (!taskInfo || !Array.isArray(taskInfo.attachmentFiles)) {
      return
    }

    this.setData({
      'taskInfo.attachmentFiles': fileResource.updateFileLocalPath(taskInfo.attachmentFiles, file, localPath)
    })
  },

  goToEditTask() {
    if (!this.data.taskId) {
      return
    }

    wx.navigateTo({
      url: `/pages/teacher/task-manage/task-edit/task-edit?task_id=${this.data.taskId}`
    })
  },

  async onDeleteTask() {
    const { taskInfo, taskId } = this.data
    if (!taskId) {
      return
    }

    const confirmed = await Toast.confirm(`确认删除任务“${taskInfo ? taskInfo.titleText : '未命名任务'}”吗？`)
    if (!confirmed) {
      return
    }

    Toast.showLoading('正在删除任务...')

    try {
      await TaskService.deleteTask(taskId)
      Toast.hideLoading()
      await Toast.showSuccess('任务已删除')
      wx.navigateBack()
    } catch (error) {
      console.error('[task-detail] onDeleteTask error:', error)
      Toast.hideLoading()
      Toast.showToast(error.message || '删除任务失败')
    }
  },

  onShareAppMessage() {
    const taskInfo = this.data.taskInfo || {}
    const teacherName = taskInfo.teacher_name || taskInfo.teacherName || '老师'
    const taskTitle = taskInfo.titleText || '任务'
    return {
      title: `${teacherName}邀请你完成${taskTitle}`,
      path: `/pages/student/task-manage/task-detail/task-detail?task_id=${this.data.taskId}`
    }
  }
})
