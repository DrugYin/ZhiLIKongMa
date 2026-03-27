// pages/student/setting/setting.js
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

  onChooseAvatar(e) {
    const { field } = e.currentTarget.dataset
    const { avatarUrl } = e.detail
    this.setData({
      [`${field}`]: avatarUrl,
      avatarChanged: true
    })
  },

  onPhoneInput(e) {
    const { field } = e.currentTarget.dataset
    const { phoneError } = this.data;
    const value = e.detail.value;
    const isPhoneNumber = /^[1][3,4,5,7,8,9][0-9]{9}$/.test(value);

    this.setData({
      [`${field}`]: value,
      phoneError: !isPhoneNumber
    });
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`${field}`]: value
    });
  },

  onGradePicker() {
    this.setData({
      gradePickerVisible: true
    })
  },

  onPickerChange(e) {
    const { key } = e.currentTarget.dataset;
    let { value } = e.detail;
    if (key === 'userInfo.grade') {
      value = value[0]
    }
    this.setData({
      [`${key}`]: value
    });
    this.onPickerCancel(e)
  },

  onPickerCancel(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({
      gradePickerVisible : false
    })
  },

  getUserInfo() {
    
  },

  onSave() {
    
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