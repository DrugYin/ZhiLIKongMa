// pages/login/login.js
import AuthService from '../../services/auth'
import toast from '../../utils/toast'
import { uploadFile } from '../../services/api'

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false,
    isFirstLogin: false,
    defaultAvatarUrl: '/assets/default-avatar.png',
    userInfo: {
      user_name: '',
      avatar_url: '',
      school: '',
      grade: '',
      phone: '',
      birthday: '',
      address: '',
    },
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
    birthdayPickerVisible: false,
    gradePickerVisible: false,
    phoneError: false,
    date: '',
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
      [`${field}`]: avatarUrl
    })
  },

  onGradePicker() {
    this.setData({
      gradePickerVisible: true
    })
  },

  onBirthdayPicker() {
    this.setData({
      birthdayPickerVisible: true
    })
    this.setData({
      date: new Date().toLocaleDateString()
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
    this.setData({
      gradePickerVisible : false
    })
  },

  onBirthdayCancel(e) {
    this.setData({
      birthdayPickerVisible: false
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

  onLogin() {
    toast.showLoading('登录中...');
    AuthService.wxLogin().then(res => {
      if (res.is_registered) {
        toast.hideLoading();
        AuthService.updateLocalUserInfo(res.user_info)
        toast.showSuccess('登录成功');
        setTimeout(() => {
          wx.navigateBack();
        }, 1000);
      } else {
        this.setData({
          isFirstLogin: true,
        });
        toast.hideLoading();
        toast.showToast('首次登录，请完善信息');
      }
    })
  },

  onRegister() {
    if (!this.validateForm()) {
      return;
    }
    toast.showLoading('注册中...')
    const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
    const filePath = this.data.userInfo.avatar_url
    uploadFile(filePath, cloudPath).then(res => {
      console.log('上传成功', res);
      this.setData({
        'userInfo.avatar_url': res.fileID
      })
      AuthService.register(this.data.userInfo).then(res => {
        toast.hideLoading();
        toast.showSuccess('注册成功');
        this.onLogin()
      }).catch(e => {
        toast.hideLoading();
        toast.showToast('注册失败，请重试');
        console.error('注册失败', e);
      })
    })
  },

  validateForm() {
    const { userInfo, phoneError } = this.data;
    if (!userInfo.user_name || !userInfo.phone || !userInfo.school || !userInfo.grade || phoneError) {
      toast.showToast('请完善必填信息');
      return false;
    }
    return true;
  },

})