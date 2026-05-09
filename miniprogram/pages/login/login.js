// pages/login/login.js
const AuthService = require('../../services/auth')
const toast = require('../../utils/toast')
const { uploadFile } = require('../../services/api')
const { GRADE_OPTIONS } = require('../../utils/constant')
const DEFAULT_AVATAR_URL = '/assets/default-avatar.png'

const USER_AGREEMENT_TEXT = [
  '欢迎使用智力控码小程序。',
  '1. 用户登录、注册和使用本小程序功能时，应保证提交的信息真实、合法、有效。',
  '2. 你可以使用本小程序查看任务、班级、提交记录、审核结果和排行榜等学习服务。',
  '3. 请勿利用本小程序上传违法、侵权、骚扰或其他不当内容。',
  '4. 因系统升级、网络波动、平台维护等原因，部分功能可能出现延迟、中断或调整。',
  '5. 你应妥善保管自己的账号相关信息，并对本人操作行为负责。'
].join('\n\n')

const PRIVACY_SUMMARY_TEXT = [
  '智力控码小程序会在必要范围内收集和使用你的相关信息，用于完成登录注册、班级管理、任务提交、审核反馈、排行榜展示等服务。',
  '可能涉及的信息包括：微信身份标识、头像昵称、手机号、学校与年级信息、任务图片与附件、审核反馈内容等。',
  '我们会在微信官方隐私保护指引中展示完整隐私说明。'
].join('\n\n')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false,
    isFirstLogin: false,
    hasConfirmedAgreement: false,
    userInfo: {
      user_name: '',
      avatar_url: '',
      school: '',
      grade: '',
      phone: '',
      birthday: '',
      address: '',
    },
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
  },

  onLogin() {
    if (!this.data.hasConfirmedAgreement) {
      toast.showToast('请先阅读并同意《用户协议》和《隐私政策》')
      return
    }

    this.doLogin()
  },

  handleAgreementChange(event) {
    const checkedValues = event.detail.value || []
    this.setData({
      hasConfirmedAgreement: checkedValues.includes('confirmed')
    })
  },

  doLogin() {
    toast.showLoading('登录中...')
    AuthService.wxLogin().then(res => {
      if (res.is_registered) {
        toast.hideLoading()
        AuthService.updateLocalUserInfo(res.user_info)
        toast.showSuccess('登录成功')
        setTimeout(() => {
          if (res.user_info && res.user_info.current_role === 'teacher') {
            wx.reLaunch({ url: '/pages/teacher/index' })
          } else {
            wx.navigateBack()
          }
        }, 1000)
      } else {
        this.setData({
          isFirstLogin: true,
        })
        toast.hideLoading()
        toast.showToast('首次登录，请完善信息')
      }
    }).catch((error) => {
      toast.hideLoading()
      toast.showToast('登录失败，请稍后重试')
      console.error('登录失败:', error)
    })
  },

  async onRegister() {
    const Form = this.selectComponent('#register-form')
    let { userInfo } = Form.getFormData()
    let shouldKeepLoading = false
    if (!this.validateForm(userInfo)) {
      return
    }

    userInfo = {
      ...userInfo,
      avatar_url: this.normalizeAvatarUrl(userInfo.avatar_url)
    }

    toast.showLoading('注册中...')

    try {
      if (this.shouldUploadAvatar(userInfo.avatar_url)) {
        const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2, 11)}.jpg`
        const uploadRes = await uploadFile(userInfo.avatar_url, cloudPath)
        userInfo.avatar_url = uploadRes.fileID
      }

      await AuthService.register(userInfo)
      toast.hideLoading()
      toast.showSuccess('注册成功')
      shouldKeepLoading = true
      this.doLogin()
    } catch (error) {
      console.error('注册失败', error)
      toast.showToast(this.getRegisterErrorMessage(error))
    } finally {
      if (!shouldKeepLoading) {
        toast.hideLoading()
      }
    }
  },

  shouldUploadAvatar(avatarUrl) {
    const value = String(avatarUrl || '').trim()
    return Boolean(value) && !value.startsWith('cloud://') && !value.startsWith('/')
  },

  normalizeAvatarUrl(avatarUrl) {
    const value = String(avatarUrl || '').trim()
    return value || DEFAULT_AVATAR_URL
  },

  getRegisterErrorMessage(error) {
    const message = String(error && error.message || '').trim()
    if (!message) {
      return '注册失败，请重试'
    }

    if (message.includes('upload') || message.includes('上传')) {
      return '头像上传失败，请检查网络后重试'
    }

    return message
  },

  validateForm(userInfo) {
    const { phoneError } = this.selectComponent('#register-form').getFormData()
    if (!userInfo.user_name || !userInfo.phone || !userInfo.school || !userInfo.grade || phoneError) {
      toast.showToast('请完善必填信息')
      return false
    }
    return true
  },

  handleSkip() {
    wx.switchTab({
      url: '/pages/student/index'
    })
  },

  handleOpenUserAgreement() {
    toast.showModal({
      title: '用户协议',
      content: USER_AGREEMENT_TEXT,
      showCancel: false,
      confirmText: '我已了解'
    }).catch((error) => {
      console.error('打开用户协议失败:', error)
    })
  },

  handleOpenPrivacyPolicy() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({
        success: () => {},
        fail: (error) => {
          console.error('打开隐私协议失败:', error)
          this.showPrivacyFallback()
        }
      })
      return
    }

    this.showPrivacyFallback()
  },

  showPrivacyFallback() {
    toast.showModal({
      title: '隐私政策',
      content: PRIVACY_SUMMARY_TEXT,
      showCancel: false,
      confirmText: '我已了解'
    }).catch((error) => {
      console.error('打开隐私政策说明失败:', error)
    })
  }

})
