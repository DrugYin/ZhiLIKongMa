const TaskService = require('../../../../services/task')
const Toast = require('../../../../utils/toast')
const formatUtils = require('../../../../utils/format')

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

    this.setData({
      loading: true
    })

    try {
      const taskInfo = await TaskService.getTaskDetail(this.data.taskId)
      this.setData({
        taskInfo: this.formatTaskInfo(taskInfo)
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
      deadlineText: item.deadline || item.deadline_date
        ? this.formatDateTime(item.deadline || `${item.deadline_date} ${item.deadline_time || '00:00'}`)
        : '未设置截止时间',
      publishTimeText: item.publish_time ? this.formatDateTime(item.publish_time) : '待发布',
      updateTimeText: item.update_time ? this.formatDateTime(item.update_time) : '待更新',
      createTimeText: item.create_time ? this.formatDateTime(item.create_time) : '待创建',
      imageCountText: `${Array.isArray(item.images) ? item.images.length : 0} 张图片`,
      fileCountText: `${Array.isArray(item.files) ? item.files.length : 0} 个附件`,
      attachmentText: Array.isArray(item.files) && item.files.length
        ? item.files.map((file) => file.file_name || '未命名附件').join(' / ')
        : '暂无附件',
      progressInfo
    }
  },

  formatProgressInfo(item = {}) {
    const source = item.progress_stats || item.progress || item.completion_stats || {}
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
    ], submissionCount, targetCount)
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
      targetCountText: this.formatCountText(targetCount),
      completionRateText: this.formatRateText(completionRate),
      passRateText: this.formatRateText(passRate),
      completionPercent: completionRate,
      completionBarStyle: `width:${completionRate}%;`,
      lastSubmitTimeText: lastSubmitTime ? this.formatDateTime(lastSubmitTime) : '待接入',
      noteText: hasRealData
        ? '当前统计将随着任务提交与审核结果自动刷新。'
        : '已预留提交统计字段，后续接入任务提交接口后会自动展示。'
    }
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
    const title = this.data.taskInfo ? this.data.taskInfo.titleText : '任务详情'
    return {
      title,
      path: `/pages/teacher/task-manage/task-detail/task-detail?task_id=${this.data.taskId}`
    }
  }
})
