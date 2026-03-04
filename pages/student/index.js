// index.js
Page({

  onLoad(options) {
    this.getTabBar().changeData({ type: 'student' })
  },

  onShow() {
    this.getTabBar().changeData({ type: 'student' })
    this.getTabBar().init('/pages/student/index')
  },

  onShareAppMessage() {
    return {
      title: '智力控码',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '智力控码',
      path: '/pages/index/index'
    }
  },

})
