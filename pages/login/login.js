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
    defaultAvatarUrl: '/assets/default-avatar.png',
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
    projects: [
      {label: '编程', value: '编程', projectId: '1001'},
      {label: '机器人', value: '机器人', projectId: '1002'},
      {label: '无人机', value: '无人机', projectId: '1003'},
    ],
    teacherInfo: {
      name: '',
      project: '',
      projectId: '',
      phone: '',
      avatarUrl: ''
    },
    gradePickerVisible: false,
    projectPickerVisible: false,
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
    const { field } = e.currentTarget.dataset
    const { avatarUrl } = e.detail 
    this.setData({
      [`${field}`]: avatarUrl
    })
  },

  onGradePicker() {
    this.setData({
      gradePickerVisible: true
    })
  },

  onProjectPicker() {
    this.setData({
      projectPickerVisible: true
    })
  },

  onPickerChange(e) {
    const { key } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`${key}`]: value
    });
    if (key === 'teacherInfo.project') {
      this.setData({
        [`teacherInfo.projectId`]: this.data.projects[e.detail.columns[0].index].projectId
      })
    }
    this.onPickerCancel(e)
  },

  onColumnChange(e) {
    const { key } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`${key}`]: value
    });
    if (key === 'teacherInfo.project') {
      this.setData({
        [`teacherInfo.projectId`]: this.data.projects[e.detail.index].projectId
      })
    }
  },

  onPickerCancel(e) {
    const { key } = e.currentTarget.dataset;
    if (key === 'userInfo.grade') {
      this.setData({
        gradePickerVisible : false
      })
    } else {
      this.setData({
        projectPickerVisible: false
      })
    }
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

    // 检查是否选择了头像，如果没有则使用默认头像
    const avatarFilePath = userInfo.avatarUrl ? userInfo.avatarUrl : this.data.defaultAvatarUrl

    // 判断是否需要上传头像
    if (userInfo.avatarUrl) {
      // 上传自定义头像到云存储
      wx.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
        filePath: avatarFilePath,
      }).then(uploadRes => {
        if (uploadRes.fileID) {
          userInfo.avatarUrl = uploadRes.fileID
          return this.registerStudent(userInfo)
        } else {
          wx.showToast({
            title: '头像上传失败',
            icon: 'none'
          })
          return Promise.reject('头像上传失败')
        }
      }).catch(err => {
        this.hideLoading()
        console.error('注册失败:', err)
      })
    } else {
      // 使用默认头像，直接注册
      userInfo.avatarUrl = this.data.defaultAvatarUrl
      this.registerStudent(userInfo)
    }
  },

  registerStudent(userInfo) {
    return wx.cloud.callFunction({
      name: 'register-student',
      data: {
        openid: this.data.openid,
        userInfo: userInfo
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
    }).catch(err => {
      this.hideLoading()
      console.error('注册失败:', err)
    })
  },

  teacherLogin() {
    this.showLoading()
    wx.cloud.callFunction({
      name: 'login',
      data: {
        openid: this.data.openid,
        role: 'teacher'
      }
    }).then(res => {
      this.hideLoading()
      if (res.result.code === 200) {
        this.setData({
          isLogin: true,
          teacherInfo: res.result.data
        })
        wx.setStorageSync('teacherInfo', res.result.data)
        wx.setStorageSync('isTeacherLogin', true)
        wx.reLaunch({
          url: '/pages/teacher/index'
        })
      } else if (res.result.code === 401) {
        wx.showToast({
          title: '该微信号未绑定教师账号',
          icon: 'none'
        })
        this.setData({
          usePasswordLogin: true
        })
      } else {
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        })
      }
    })
  },

  teacherPasswordLogin() {
    const { teacherInfo, loginAccount, loginPassword } = this.data;
    if (!loginAccount) {
      wx.showToast({
        title: '请输入账号',
        icon: 'none'  
      })
      return ;
    }
    if (!loginPassword) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'  
      })
      return ;
    }
    this.showLoading()
    wx.cloud.callFunction({
      name: 'teacher-login',
      data: {
        openid: this.data.openid,
        account: loginAccount,
        password: loginPassword
      }
    }).then(res => {
      this.hideLoading()
      if (res.result.code === 200) {
        if (res.result.data.needImprove) {
          this.setData({
            isFirstLogin: true,
            teacherInfo: res.result.data
          })
          wx.showToast({
            title: '请完善信息',
            icon: 'none'
          })
        } else {
          this.setData({
            isLogin: true,
            teacherInfo: res.result.data
          })
          wx.setStorageSync('teacherInfo', res.result.data)
          wx.setStorageSync('isTeacherLogin', true)
          wx.showToast({
            title: '登录成功',
            icon: 'none'
          })
          wx.reLaunch({
            url: '/pages/teacher/index'
          })
        }
      } else {
        wx.showToast({
          title: res.result.msg,
          icon: 'none'
        })
      }
    })
  },

  teacherRegister() {
    const teacherInfo = this.data.teacherInfo
    if (!teacherInfo.name) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      })
      return ;
    }
    if (!teacherInfo.project) {
      wx.showToast({
        title: '请选择项目',
        icon: 'none'
      })
      return ;
    }
    if (!teacherInfo.phone || this.data.phoneError) {
      wx.showToast({
        title: '请输入正确手机号',
        icon: 'none'
      })
      return ;
    }
    this.showLoading()

    // 检查是否选择了头像，如果没有则使用默认头像
    const avatarFilePath = teacherInfo.avatarUrl ? teacherInfo.avatarUrl : this.data.defaultAvatarUrl

    // 判断是否需要上传头像
    if (teacherInfo.avatarUrl) {
      // 上传自定义头像到云存储
      wx.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
        filePath: avatarFilePath,
      }).then(uploadRes => {
        if (uploadRes.fileID) {
          teacherInfo.avatarUrl = uploadRes.fileID
          return this.registerTeacher(teacherInfo)
        } else {
          wx.showToast({
            title: '头像上传失败',
            icon: 'none'
          })
          return Promise.reject('头像上传失败')
        }
      }).catch(err => {
        this.hideLoading()
        console.error('注册失败:', err)
      })
    } else {
      // 使用默认头像，直接注册
      teacherInfo.avatarUrl = this.data.defaultAvatarUrl
      this.registerTeacher(teacherInfo)
    }
  },

  registerTeacher(teacherInfo) {
    console.log('registerTeacher:', teacherInfo)
    wx.cloud.callFunction({
      name: 'update-teacher-info',
      data: {
        openid: this.data.openid,
        teacherInfo: teacherInfo
      }
    }).then(res => {
      this.hideLoading()
      if (res.result.code === 200) {
        wx.showToast({
          title: '提交成功',
          icon: 'none'
        })
        wx.setStorageSync('teacherInfo', res.result.data)
        wx.setStorageSync('isTeacherLogin', true)
        wx.reLaunch({
          url: '/pages/teacher/index'
        })
      } else {
        console.log(res.result)
        wx.showToast({
          title: '注册失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      this.hideLoading()
      console.error('注册失败:', err)
      wx.showToast({
        title: '注册失败',
        icon: 'none'
      })
    })
  }
})