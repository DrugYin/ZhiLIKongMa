// pages/login/login.js
import Toast, { hideToast } from 'tdesign-miniprogram/toast';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false,
    isTeacherLogin: false,
    usePasswordLogin: false,
    isFirstLogin: false,
    openid: '',
    loginAccount: '',
    loginPassword: '',
    userInfo: {
      userName: '',
      avatarUrl: '',
      school: '',
      grade: '',
      phone: '',
      address: '',
      points: 0
    },
    isLoading: false,
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
    gradePickerVisible: false,
    phoneError: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.setData({
      openid: wx.getStorageSync('openid')
    })
    this.checkLogin()
    if (!this.data.isLogin) {
      if (!options.userLogin) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
      }
    } else {
      wx.showToast({
        title: '已登录',
        icon: 'none'
      })
      wx.navigateBack()
    }
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo')
    const isStudentLogin = wx.getStorageSync('isStudentLogin')
    const isTeacherLogin = wx.getStorageSync('isTeacherLogin')
    if (userInfo || isStudentLogin || isTeacherLogin) {
      this.setData({
        isLogin: true,
        userInfo: userInfo
      })
    }
  },

  handleGoBack() {
    wx.navigateBack()
  },

  onTabsChange(e) {
    this.setData({
      isTeacherLogin: e.detail.value
    })
  },

  handleChangeLoginType() {
    this.setData({
      usePasswordLogin: !this.data.usePasswordLogin
    })
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

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail 
    this.setData({
      'userInfo.avatarUrl': avatarUrl
    })
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
      [`${key}PickerVisible`]: false,
      [`userInfo.${key}`]: value
    });
  },

  onColumnChange(e) {
    const { key } = e.currentTarget.dataset;
    const { value } = e.detail;

    this.setData({
      [`userInfo.${key}`]: value
    });
  },

  onPickerCancel(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({
      [`${key}PickerVisible`] : false
    })
  },

  onPhoneInput(e) {
    const { phoneError } = this.data;
    const value = e.detail.value;
    const isPhoneNumber = /^[1][3,4,5,7,8,9][0-9]{9}$/.test(value);

    this.setData({
      'userInfo.phone': value,
      phoneError: !isPhoneNumber
    });
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`userInfo.${field}`]: value
    });
  },

  studentLogin() {
    this.showLoading()
    wx.cloud.callFunction({
      name: 'login',
      data: {
        openid: this.data.openid,
        role: 'student'
      }
    }).then(res => {
      this.hideLoading()
      if (res.result.code === 200) {
        this.setData({
          isLogin: true,
          userInfo: res.result.data
        })
        wx.setStorageSync('userInfo', res.result.data)
        wx.setStorageSync('isStudentLogin', true)
        wx.navigateBack()
      } else if (res.result.code === 401) {
        wx.showToast({
          title: '首次登录请先完善信息',
          icon: 'none'
        })
        this.setData({
          isFirstLogin: true
        })
      } else {
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        })
      }
    })
  },

  studentRegister() {
    const userInfo = this.data.userInfo
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
        title: '请输入正确手机号',
        icon: 'none'
      })
      return ;
    }
    this.showLoading()
    wx.cloud.uploadFile({
      cloudPath: `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
      filePath: this.data.userInfo.avatarUrl,
      success: res => {
        if (res.fileID) {
          userInfo.avatarUrl = res.fileID
        } else {
          wx.showToast({
            title: '头像上传失败',
            icon: 'none'
          })
          return ;
        }
      },
      fail: console.error
    })
    wx.cloud.callFunction({
      name: 'register-student',
      data: {
        openid: this.data.openid,
        userInfo: this.data.userInfo
      }
    }).then(res => {
      this.hideLoading()
      if (res.result.code === 200) {
        wx.showToast({
          title: '注册成功',
          icon: 'none'
        })
      } else {
        wx.showToast({
          title: res.result.msg,
          icon: 'none'
        })
      }
      wx.setStorageSync('userInfo', res.result.data)
      wx.setStorageSync('isStudentLogin', true)
      wx.navigateBack()
    })
  },
})