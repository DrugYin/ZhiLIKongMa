const { lotteryApi } = require('../../../services/api')

Page({
  data: {
    loading: true,
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    loadingMore: false
  },

  onLoad() {
    this.loadRecords()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore()
    }
  },

  async loadRecords() {
    this.setData({ loading: true, page: 1, list: [] })
    try {
      const res = await lotteryApi.getDrawRecords({ page: 1, page_size: this.data.pageSize })
      if (res.success && res.data) {
        this.setData({
          list: res.data.list || [],
          total: res.data.total || 0,
          hasMore: Boolean(res.data.has_more)
        })
      }
    } catch (e) {
      console.error('[draw-records] load error:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return

    this.setData({ loadingMore: true })
    const nextPage = this.data.page + 1

    try {
      const res = await lotteryApi.getDrawRecords({ page: nextPage, page_size: this.data.pageSize })
      if (res.success && res.data) {
        this.setData({
          list: [...this.data.list, ...(res.data.list || [])],
          page: nextPage,
          total: res.data.total || 0,
          hasMore: Boolean(res.data.has_more)
        })
      }
    } catch (e) {
      console.error('[draw-records] loadMore error:', e)
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  getStatusText(status) {
    const map = { drawn: '已抽中', claimed: '已领取', expired: '已过期' }
    return map[status] || status
  },

  getTypeTag(type) {
    const map = { physical: '实体', virtual: '虚拟', points: '积分' }
    return map[type] || type
  },

  formatTime(time) {
    if (!time) return ''
    const d = new Date(time)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  onRefresh() {
    this.loadRecords()
  }
})
