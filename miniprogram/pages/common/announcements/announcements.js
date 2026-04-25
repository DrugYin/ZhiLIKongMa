const AnnouncementService = require('../../../services/announcement')
const formatUtils = require('../../../utils/format')

Page({
  data: {
    loading: true,
    announcements: [],
    total: 0
  },

  onLoad() {
    this.loadAnnouncements()
  },

  onPullDownRefresh() {
    this.loadAnnouncements().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadAnnouncements() {
    this.setData({
      loading: true
    })

    try {
      const data = await AnnouncementService.getAnnouncements({
        page: 1,
        page_size: 50
      })
      const list = (data.list || []).map((item) => ({
        ...item,
        publishText: this.formatPublishTime(item.publish_time),
        modeText: item.display_mode === 'always' ? '每次进入弹出' : '弹出一次',
        sourceText: item.source_type === 'system' ? '系统通知' : '平台公告',
        readText: item.is_read ? '已读' : '未读'
      }))

      this.setData({
        announcements: list,
        total: data.total || list.length
      })
    } catch (error) {
      console.error('[announcements] load error:', error)
      wx.showToast({
        title: error.message || '公告加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({
        loading: false
      })
    }
  },

  async handleRead(e) {
    const { id } = e.currentTarget.dataset
    if (!id) {
      return
    }

    try {
      await AnnouncementService.markRead(id)
      const announcements = this.data.announcements.map((item) => (
        item._id === id
          ? {
              ...item,
              is_read: true,
              readText: '已读'
            }
          : item
      ))
      this.setData({ announcements })
    } catch (error) {
      console.error('[announcements] mark read error:', error)
      wx.showToast({
        title: error.message || '标记失败',
        icon: 'none'
      })
    }
  },

  async handleAction(e) {
    const { id } = e.currentTarget.dataset
    const announcement = this.data.announcements.find((item) => item._id === id)

    if (!announcement) {
      return
    }

    try {
      if (!announcement.is_read) {
        await AnnouncementService.markRead(id)
      }
    } catch (error) {
      console.error('[announcements] action mark read error:', error)
    }

    AnnouncementService.openAction(announcement)
  },

  formatPublishTime(value) {
    if (!value) {
      return '发布时间待同步'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return '发布时间待同步'
    }

    return formatUtils.formatDate(date, 'YYYY-MM-DD HH:mm')
  },

  onShareAppMessage() {
    return {
      title: '智力控码公告',
      path: '/pages/common/announcements/announcements'
    }
  }
})
