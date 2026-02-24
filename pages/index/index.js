// index.js
Page({
  onShow() {
    this.getTabBar().init('/pages/index/index')
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
