// pages/login/login.js
import AuthService from '../../services/auth'
import toast from '../../utils/toast'
import { uploadFile } from '../../services/api'
import { GRADE_OPTIONS } from '../../utils/constant'

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false,
    isFirstLogin: false,
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
    const Form = this.selectComponent('#register-form')
    let { userInfo } = Form.getFormData()
    if (!this.validateForm(userInfo)) {
      return;
    }
    toast.showLoading('注册中...')
    const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
    const filePath = userInfo.avatar_url
    uploadFile(filePath, cloudPath).then(res => {
      console.log('上传成功', res);
      userInfo.avatar_url = res.fileID
      AuthService.register(userInfo).then(res => {
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

  validateForm(userInfo) {
    console.log('userInfo', userInfo)
    const { phoneError } = this.selectComponent('#register-form').getFormData()
    if (!userInfo.user_name || !userInfo.phone || !userInfo.school || !userInfo.grade || phoneError) {
      toast.showToast('请完善必填信息');
      return false;
    }
    return true;
  },

  handleSkip() {
    wx.switchTab({
      url: '/pages/student/index'
    })
  },

})