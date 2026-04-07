const projectService = require('../../../../config/project')
const ClassService = require('../../../../services/class')
const TaskService = require('../../../../services/task')
const Toast = require('../../../../utils/toast')

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

      this.setData({
        taskInfo,
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
      images: [],
      files: []
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
          wx.redirectTo({
            url: `/pages/teacher/task-manage/task-detail/task-detail?task_id=${taskId}`
          })
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
