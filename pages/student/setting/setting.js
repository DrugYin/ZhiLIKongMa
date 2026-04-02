// pages/student/setting/setting.js
const { uploadFile } = require('../../../services/api')
const Toast = require('../../../utils/toast')
const AuthService = require('../../../services/auth')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      user_name: '',
      school: '',
      grade: '',
      phone: '',
      address: '',
      avatar_url: ''
    },
    defaultAvatarUrl: '/assets/default-avatar.png',
    loading: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getUserInfo()
  },

  getUserInfo() {
    Toast.showLoading('加载中...')
    AuthService.getUserInfo().then(res => {
      Toast.hideLoading()
      this.setData({
        userInfo: res
      })
    })
  },

  async onSave() {
    const Form = this.selectComponent('#user-form')
    let { userInfo } = Form.getFormData()
    if (!this.validateForm(userInfo)) {
      return;
    }
    Toast.showLoading('保存中...')
    if (Form.isAvatarChanged()) {
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
      const filePath = userInfo.avatar_url
      uploadFile(filePath, cloudPath).then(res => {
        userInfo.avatar_url = res.fileID
        this.handleUpdate(userInfo)
      }).catch(e => {
        toast.hideLoading();
        toast.showToast('头像上传失败，请重试');
        console.error('头像上传失败', e);
      })
    } else {
      this.handleUpdate(userInfo)
    }
  },
  
  handleUpdate(userInfo) {
    AuthService.updateUserInfo(userInfo).then(res => {
      Toast.hideLoading()
      Toast.showSuccess('保存成功')
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    }).catch(e => {
      Toast.hideLoading()
      Toast.showError(e.message || '保存失败')
    })
  },

  validateForm(userInfo) {
    const { phoneError } = this.selectComponent('#user-form').getFormData()
    if (!userInfo.user_name || !userInfo.phone || !userInfo.school || !userInfo.grade || phoneError) {
      Toast.showToast('请完善必填信息');
      return false;
    }
    return true;
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
