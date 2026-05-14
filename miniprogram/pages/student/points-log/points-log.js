const AuthService = require('../../../services/auth')
const Toast = require('../../../utils/toast')

Page({
  data: {
    list: [],
    loading: false,
    refreshing: false,
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    filterType: 'all', // all, income, expense
    filterOptions: [
      { label: '全部', value: 'all' },
      { label: '收入', value: 'income' },
      { label: '支出', value: 'expense' }
    ]
  },

  onLoad() {
    if (!AuthService.isLoggedIn()) {
      Toast.showError('请先登录')
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    this.loadList(true)
  },

  async loadList(refresh = false) {
    if (this.data.loading) return

    if (refresh) {
      this.setData({
        page: 1,
        list: [],
        hasMore: true
      })
    }

    if (!this.data.hasMore && !refresh) return

    this.setData({ loading: true })

    try {
      const params = {
        page: this.data.page,
        page_size: this.data.pageSize
      }

      if (this.data.filterType !== 'all') {
        params.type = this.data.filterType
      }

      const res = await wx.cloud.callFunction({
        name: 'get-points-log',
        data: params
      })

      const result = res.result || {}
      if (result.success) {
        const fetchedList = (result.data.list || []).map(item => ({
          ...item,
          formattedTime: this.formatTime(item.create_time),
          sourceText: this.getSourceText(item.source)
        }))

        const newList = refresh
          ? fetchedList
          : [...this.data.list, ...fetchedList]

        this.setData({
          list: newList,
          total: result.data.total || 0,
          page: this.data.page + 1,
          hasMore: newList.length < (result.data.total || 0)
        })
      } else {
        Toast.showError(result.message || '获取积分明细失败')
      }
    } catch (err) {
      console.error('[points-log] 加载失败:', err)
      Toast.showError('网络错误，请重试')
    } finally {
      this.setData({
        loading: false,
        refreshing: false
      })
    }
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadList(true)
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    this.loadList(false)
  },

  onFilterChange(e) {
    const { value } = e.currentTarget.dataset
    if (value === this.data.filterType) return

    this.setData({ filterType: value })
    this.loadList(true)
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  },

  getSourceText(source) {
    const sourceMap = {
      register_gift: '注册赠送',
      task_reward: '任务奖励',
      admin_grant: '管理员发放',
      admin_deduct: '管理员扣除',
      admin_adjust: '积分调整',
      lottery_cost: '抽奖消耗',
      rollback: '积分回滚'
    }
    return sourceMap[source] || source
  },

  getTypeText(type) {
    return type === 'income' ? '收入' : '支出'
  }
})
