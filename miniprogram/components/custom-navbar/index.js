const AuthService = require('../../services/auth')

Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    showBack: {
      type: Boolean,
      value: false
    },
    placeholder: {
      type: Boolean,
      value: false
    },
    titleClass: {
      type: String,
      value: ''
    }
  },

  methods: {
    getFallbackUrl() {
      return AuthService.getCurrentRole() === 'teacher'
        ? '/pages/teacher/index'
        : '/pages/student/index'
    },

    navigateToFallback() {
      const url = this.getFallbackUrl()

      wx.switchTab({
        url,
        fail: () => {
          wx.reLaunch({
            url
          })
        }
      })
    },

    handleGoBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        this.triggerEvent('go-back');
        return
      }
      this.navigateToFallback()
    }
  }
})
