const TaskService = require('../../../../services/task')
const Toast = require('../../../../utils/toast')
const formatUtils = require('../../../../utils/format')
const fileResource = require('../../../../utils/file-resource')

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
      const [imageInfo, attachmentFiles] = await Promise.all([
        fileResource.buildImagePreviewData(taskInfo.images),
        fileResource.buildAttachmentPreviewFiles(taskInfo.files)
      ])

      this.setData({
        taskInfo: this.formatTaskInfo({
          ...taskInfo,
          image_list: imageInfo.imageList,
          image_preview_urls: imageInfo.previewUrls,
          attachment_files: attachmentFiles
        })
      })
      this._pageReady = true
    } catch (error) {
      console.error('[student-task-detail] initPage error:', error)
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

    return {
      ...item,
      titleText: item.title || '未命名任务',
      descriptionText: item.description || '暂无任务说明',
      projectText: item.project_name || item.project_code || '未设置项目',
      classText: taskType === 'class'
        ? (item.class_name || '未设置班级')
        : '全部学生可见',
      taskTypeText: TASK_TYPE_TEXT[taskType] || '未分类任务',
      visibilityText: VISIBILITY_TEXT[visibility] || '可见范围未设置',
      difficultyText: DIFFICULTY_TEXT[difficulty] || '未设置难度',
      difficultyStyle: `color:${DIFFICULTY_COLOR[difficulty] || '#6f7f91'};background:${this.toRgba(DIFFICULTY_COLOR[difficulty] || '#6f7f91', 0.12)};`,
      pointsText: `${Number(item.points || 0)} 分`,
      deadlineText: item.deadline || item.deadline_date
        ? this.formatDateTime(item.deadline || `${item.deadline_date} ${item.deadline_time || '00:00'}`)
        : '未设置截止时间',
      publishTimeText: item.publish_time ? this.formatDateTime(item.publish_time) : '待发布',
      updateTimeText: item.update_time ? this.formatDateTime(item.update_time) : '待更新',
      createTimeText: item.create_time ? this.formatDateTime(item.create_time) : '待创建',
      teacherText: item.teacher_name || '待老师补充',
      imageCountText: `${Array.isArray(item.images) ? item.images.length : 0} 张图片`,
      imageList: Array.isArray(item.image_list) ? item.image_list : [],
      imagePreviewUrls: Array.isArray(item.image_preview_urls) ? item.image_preview_urls : [],
      fileCountText: `${Array.isArray(item.files) ? item.files.length : 0} 个附件`,
      attachmentFiles: Array.isArray(item.attachment_files) ? item.attachment_files : []
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
      console.error('[student-task-detail] onPreviewFile error:', error)
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

  onCopyDescription() {
    const descriptionText = String(this.data.taskInfo && this.data.taskInfo.descriptionText || '').trim()

    if (!descriptionText || descriptionText === '暂无任务说明') {
      Toast.showToast('暂无可复制的任务说明')
      return
    }

    wx.setClipboardData({
      data: descriptionText,
      success: () => {
        Toast.showSuccess('任务说明已复制', 2000)
      },
      fail: () => {
        Toast.showToast('复制失败，请稍后重试')
      }
    })
  },

  onShareAppMessage() {
    const title = this.data.taskInfo ? this.data.taskInfo.titleText : '任务详情'
    return {
      title,
      path: `/pages/student/task-manage/task-detail/task-detail?task_id=${this.data.taskId}`
    }
  }
})
