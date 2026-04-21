// pages/teacher/class-manage/class-edit/class-edit.js
const projectService = require('../../../../config/project')
const ClassService = require('../../../../services/class')
const Toast = require('../../../../utils/toast')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    classId: '',
    isEdit: false,
    pageTitle: '新建班级',
    pageDesc: '完善班级信息后即可创建，后续可继续补充成员与任务配置。',
    submitText: '创建班级',
    loading: true,
    saving: false,
    projectPickerVisible: false,
    projectOptions: [],
    projectMap: {},
    classInfo: null,
    classForm: {
      class_name: '',
      project_code: '',
      project_name: '',
      max_members: 30,
      class_time: '',
      location: '',
      description: ''
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const classId = String(options.class_id || '').trim()
    const isEdit = Boolean(classId)

    this.setData({
      classId,
      isEdit,
      pageTitle: isEdit ? '编辑班级' : '新建班级',
      pageDesc: isEdit
        ? '可以调整班级基础信息，保存后会同步更新班级详情页展示。'
        : '完善班级信息后即可创建，后续可继续补充成员与任务配置。',
      submitText: isEdit ? '保存修改' : '创建班级'
    })

    this.initPage()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.initPage()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  async initPage() {
    this.setData({
      loading: true
    })

    try {
      await this.loadProjectOptions()

      if (this.data.isEdit) {
        await this.loadClassDetail()
      }
    } catch (error) {
      console.error('[class-edit] initPage error:', error)
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
    const projectMap = projects.reduce((map, item) => {
      map[item.project_code] = item
      return map
    }, {})

    this.setData({
      projectOptions,
      projectMap
    })
  },

  async loadClassDetail() {
    Toast.showLoading('班级详情加载中...')
    try {
      const classInfo = await ClassService.getClassDetail(this.data.classId)

      this.setData({
        classInfo,
        classForm: {
          class_name: classInfo.class_name || '',
          project_code: classInfo.project_code || '',
          project_name: classInfo.project_name || '',
          max_members: classInfo.max_members || 30,
          class_time: classInfo.class_time || '',
          location: classInfo.location || '',
          description: classInfo.description || ''
        }
      })
    } finally {
      Toast.hideLoading()
    }
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
      'classForm.project_code': value || '',
      'classForm.project_name': project.project_name || ''
    })
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value

    this.setData({
      [`classForm.${field}`]: typeof value === 'string' ? value.trimStart() : value
    })
  },

  onNumberChange(e) {
    const { field } = e.currentTarget.dataset
    const value = Number(e.detail.value || 0)

    this.setData({
      [`classForm.${field}`]: value > 0 ? value : 0
    })
  },

  validateForm() {
    const { classForm } = this.data

    if (!classForm.class_name.trim()) {
      Toast.showToast('请填写班级名称')
      return false
    }

    if (!classForm.project_code) {
      Toast.showToast('请选择所属项目')
      return false
    }

    if (!Number.isInteger(Number(classForm.max_members)) || Number(classForm.max_members) <= 0) {
      Toast.showToast('请填写正确的人数上限')
      return false
    }

    return true
  },

  async onSubmit() {
    if (!this.validateForm() || this.data.saving) {
      return
    }

    this.setData({
      saving: true
    })

    try {
      const payload = {
        ...this.data.classForm,
        class_name: this.data.classForm.class_name.trim(),
        location: this.data.classForm.location.trim(),
        class_time: this.data.classForm.class_time.trim(),
        description: this.data.classForm.description.trim(),
        max_members: Number(this.data.classForm.max_members)
      }

      const result = this.data.isEdit
        ? await ClassService.updateClass({
          class_id: this.data.classId,
          ...payload
        })
        : await ClassService.createClass(payload)

      await Toast.showSuccess(this.data.isEdit ? '班级更新成功' : '班级创建成功')

      const classId = result && result._id
      if (classId) {
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/teacher/class-manage/class-detail/class-detail?class_id=${classId}`
          })
          return
        }, 1000)
      }
    } catch (error) {
      console.error('[class-edit] onSubmit error:', error)
      Toast.showToast(error.message || (this.data.isEdit ? '班级更新失败' : '班级创建失败'))
    } finally {
      this.setData({
        saving: false
      })
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: this.data.pageTitle,
      path: '/pages/teacher/class-manage/class-manage'
    }
  }
})
