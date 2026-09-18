const { lotteryApi } = require('../../../../services/api')
const { formatDate } = require('../../../../utils/format')
const { DRAW_RECORD_STATUS_TEXT, PRIZE_TYPE_TEXT } = require('../../../../utils/constant')

function decorateItem(item) {
  const typeLabel = PRIZE_TYPE_TEXT[item.prize_type] || item.prize_type || '虚拟'
  const statusLabel = DRAW_RECORD_STATUS_TEXT[item.status] || item.status || '已抽中'
  const timeLabel = item.create_time ? formatDate(item.create_time, 'YYYY-MM-DD HH:mm') : ''
  const isRedeemed = item.is_redeemed
  return {
    ...item,
    _meta: `${timeLabel} / ${typeLabel} / ${statusLabel}`,
    _cost: `-${item.points_cost || 0}`,
    _value: item.prize_value ? `￥${item.prize_value}` : '',
    _redeemTag: isRedeemed ? '已兑奖' : '未兑奖',
    _redeemClass: isRedeemed ? 'redeemed' : ''
  }
}

Page({
  data: {
    loading: true,
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    loadingMore: false,
    errorMsg: ''
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
    this.setData({ loading: true, page: 1, list: [], errorMsg: '' })
    try {
      const res = await lotteryApi.getDrawRecords({ page: 1, page_size: this.data.pageSize })
      if (res.success && res.data) {
        this.setData({
          list: (res.data.list || []).map(decorateItem),
          total: res.data.total || 0,
          hasMore: Boolean(res.data.has_more)
        })
      } else {
        const msg = (res && res.message) || '加载失败'
        this.setData({ errorMsg: msg })
        wx.showToast({ title: msg, icon: 'none' })
      }
    } catch (e) {
      console.error('[draw-records] load error:', e)
      this.setData({ errorMsg: '加载失败' })
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
          list: [...this.data.list, ...(res.data.list || []).map(decorateItem)],
          page: nextPage,
          total: res.data.total || 0,
          hasMore: Boolean(res.data.has_more)
        })
      } else {
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' })
      }
    } catch (e) {
      console.error('[draw-records] loadMore error:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  onRefresh() {
    this.loadRecords()
  }
})
