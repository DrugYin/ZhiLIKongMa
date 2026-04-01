// pages/teacher/mine/mine.js
import AuthService from '../../../services/auth'
import Toast from '../../../utils/toast'

Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  goToStudent() {
    Toast.showLoading('切换中...')
    AuthService.switchRole('student').then(res => {
      if (res) {
        Toast.showSuccess('切换成功')
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/student/index'
          })
        }, 1000)
      }
    }).catch(e => {
      Toast.showError(e.message)
    })
  },
  
  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.getTabBar().changeData({ type: 'teacher' })
    this.getTabBar().init('/pages/teacher/mine/mine')
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

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