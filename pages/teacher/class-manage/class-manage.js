// pages/teacher/class-manage/class-manage.js
const projectService = require('../../../config/project')
const Toast = require('../../../utils/toast')
Page({

  /**
   * 页面的初始数据
   */
  data: {
    projects: {
      value: 'all',
      options: [
        {value: 'all', label: '全部'}
      ]
    },
    classes: {
      value: 'all',
      options: [
        {value: 'all', label: '全部'}
      ]
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadProjects()
  },

  loadProjects() {
    Toast.showLoading('加载中...')
    projectService.getProjectOptions().then(res => {
      const projects = this.data.projects
      projects.options.push(...res)
      this.setData({
        projects
      })
    }).catch((error) => {
      console.error('[class-manage] loadProjects error:', error)
      Toast.showToast('项目列表加载失败')
    }).finally(() => {
      Toast.hideLoading()
    })
  },

  onDropdownChange(e) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    this.setData({
      [`${field}.value`]: value
    })
  },

  goToAddClass(e) {
    wx.navigateTo({
      url: '/pages/teacher/class-manage/class-edit/class-edit'
    })
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

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})
