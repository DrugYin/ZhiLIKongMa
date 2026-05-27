const { lotteryApi } = require('../../../services/api')

const STATUS_MAP = { drawn: '已抽中', claimed: '已领取', expired: '已过期' }
const TYPE_MAP = { physical: '实物', virtual: '虚拟', points: '积分' }

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatTimeStr(time) {
  if (!time) return ''
  const d = new Date(time)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function decorateItem(item) {
  const typeLabel = TYPE_MAP[item.prize_type] || item.prize_type || '虚拟'
  const statusLabel = STATUS_MAP[item.status] || item.status || '已抽中'
  const timeLabel = formatTimeStr(item.create_time)
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
