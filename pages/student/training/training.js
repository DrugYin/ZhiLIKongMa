// pages/student/training/training.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    classes: {
      value: 'all',
      options: [
        {
          value: 'all',
          label: '全部'
        }
      ]
    },
    projects: {
      value: 'all',
      options: [
        {
          value: 'all',
          label: '全部'
        }
      ]
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    var projects = this.data.projects
    projects.value = options.projectId || 'all'
    this.setData({
      projects
    })
    this.loadProjects()
  },

  handleGoBack() {
    wx.navigateBack()
  },

  loadProjects() {
    wx.cloud.database().collection('projects').get({
      success: (res) => {
        var projects = this.data.projects
        projects.options.push(...res.data)
        this.setData({
          projects
        })
      }
    })
  },

  onDropdownChange(e) {
    // console.log(e.currentTarget.dataset)
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    this.setData({
      [`${field}.value`]: value
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