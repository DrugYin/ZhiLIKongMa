// pages/student/setting/setting.js
import Toast, { hideToast } from 'tdesign-miniprogram/toast';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    phoneError: false,
    avatarChanged: false,
    grades: [
      {label: '一年级', value: '一年级'},
      {label: '二年级', value: '二年级'},
      {label: '三年级', value: '三年级'},
      {label: '四年级', value: '四年级'},
      {label: '五年级', value: '五年级'},
      {label: '六年级', value: '六年级'},
      {label: '初一', value: '初一'},
      {label: '初二', value: '初二'},
      {label: '初三', value: '初三'},
      {label: '高一', value: '高一'},
      {label: '高二', value: '高二'},
      {label: '高三', value: '高三'},
    ],
    loading: false,
    defaultAvatarUrl: '/assets/default-avatar.png'
  },

  showLoading() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '加载中...',
      theme: 'loading',
      direction: 'column',
    });
  },

  hideLoading() {
    hideToast({
      context: this,
      selector: '#t-toast',
    });
  },

  handleGoBack() {
    wx.navigateBack()
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getUserInfo()
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
    const { value } = e.detail;
    this.setData({
      [`${key}`]: value
    });
    this.onPickerCancel(e)
  },

  onColumnChange(e) {
    const { key } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`${key}`]: value
    });
  },

  onPickerCancel(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({
      gradePickerVisible : false
    })
  },

  getUserInfo() {
    this.showLoading()
    const openid = wx.getStorageSync('openid')
    try {
      wx.cloud.callFunction({
        name: 'get-user-info',
        data: {
          openid: openid
        }
      }).then(res => {
        this.hideLoading()
        if (res && res.result && res.result.code === 200) {
          this.setData({
            userInfo: res.result.data
          })
        } else {
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          })
          wx.navigateBack()
          console.error(e)
        }
      })
    } catch(e) {
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none'
      })
      wx.navigateBack()
      console.error(e)
    }
  },

  onSave() {
    var userInfo = this.data.userInfo
    if (!userInfo.userName) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      })
      return ;
    }
    if (!userInfo.school) {
      wx.showToast({
        title: '请输入学校',
        icon: 'none'
      })
      return ;
    }
    if (!userInfo.grade) {
      wx.showToast({
        title: '请选择年级',
        icon: 'none'
      })
      return ;
    }
    if (!userInfo.phone || this.data.phoneError) {
      wx.showToast({
        title: '请输入正确的手机号码',
        icon: 'none'
      })
      return ;
    }
    this.showLoading()
    this.setData({
      loading: true
    })
    // 判断是否需要上传头像
    if (this.data.avatarChanged && userInfo.avatarUrl && !userInfo.avatarUrl.startsWith('cloud://')) {
      // 用户选择了新头像，上传自定义头像到云存储
      wx.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
        filePath: userInfo.avatarUrl,
      }).then(uploadRes => {
        if (uploadRes.fileID) {
          userInfo.avatarUrl = uploadRes.fileID
          return this.updateUserInfo(userInfo)
        } else {
          wx.showToast({
            title: '头像上传失败',
            icon: 'none'
          })
          return Promise.reject('头像上传失败')
        }
      }).catch(err => {
        this.hideLoading()
        console.error('保存失败:', err)
      })
    } else {
      // 头像未修改，或者是云存储链接，直接保存
      if (!userInfo.avatarUrl) {
        userInfo.avatarUrl = this.data.defaultAvatarUrl
      }
      this.updateUserInfo(userInfo)
    }
  },

  updateUserInfo(userInfo) {
    const openid = wx.getStorageSync('openid')
    return wx.cloud.callFunction({
      name: 'update-user-info',
      data: {
        openid: openid,
        userInfo: userInfo
      }
    }).then(res => {
      this.hideLoading()
      this.setData({
        loading: false
      })
      if (res.result.code === 200) {
        wx.showToast({
          title: '更新成功',
          icon: 'none'
        })
        this.setData({
          userInfo: res.result.data
        })
        wx.setStorageSync('userInfo', res.result.data)
      } else {
        wx.showToast({
          title: res.result.msg,
          icon: 'none'
        })
      }
    }).catch(err => {
      this.hideLoading()
      this.setData({
        loading: false
      })
      console.error('保存失败:', err)
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