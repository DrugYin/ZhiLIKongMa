const { callFunction } = require('./api')

class AnnouncementService {
  static parseQuery(queryText = '') {
    return String(queryText || '')
      .split('&')
      .filter(Boolean)
      .reduce((result, item) => {
        const [rawKey, ...rawValue] = item.split('=')
        const key = decodeURIComponent(rawKey || '')
        if (!key) {
          return result
        }

        result[key] = decodeURIComponent(rawValue.join('=') || '')
        return result
      }, {})
  }

  static async getAnnouncements(params = {}) {
    const res = await callFunction({
      name: 'get-announcements',
      data: {
        action: 'list',
        ...params
      }
    })

    if (!res.success) {
      throw new Error(res.message || '获取公告失败')
    }

    return res.data || {}
  }

  static async getPopupAnnouncements() {
    return this.getAnnouncements({
      only_popup: true,
      page: 1,
      page_size: 20
    })
  }

  static async markRead(announcementId) {
    if (!announcementId) {
      return null
    }

    const res = await callFunction({
      name: 'get-announcements',
      data: {
        action: 'read',
        announcement_id: announcementId
      }
    })

    if (!res.success) {
      throw new Error(res.message || '标记公告已读失败')
    }

    return res.data || {}
  }

  static openAction(announcement = {}) {
    const url = String(announcement.action_url || '').trim()
    if (!url) {
      return false
    }

    const normalizedUrl = url.startsWith('/') ? url : `/${url}`
    const baseUrl = normalizedUrl.split('?')[0]

    if (baseUrl === '/pages/teacher/pending/pending' && normalizedUrl.includes('?')) {
      const query = this.parseQuery(normalizedUrl.split('?')[1])
      wx.setStorageSync('teacher_pending_route_hint', {
        type: query.type || '',
        recordId: query.record_id || query.id || '',
        createTime: Date.now()
      })
      wx.switchTab({
        url: baseUrl
      })
      return true
    }

    const tabPages = [
      '/pages/student/index',
      '/pages/student/rank/rank',
      '/pages/student/mine/mine',
      '/pages/teacher/index',
      '/pages/teacher/pending/pending',
      '/pages/teacher/task-manage/task-manage',
      '/pages/teacher/mine/mine'
    ]

    if (tabPages.includes(baseUrl)) {
      const hasQuery = normalizedUrl.includes('?')
      const navigator = hasQuery ? wx.reLaunch : wx.switchTab
      navigator({
        url: normalizedUrl
      })
      return true
    }

    wx.navigateTo({
      url: normalizedUrl
    })
    return true
  }
}

module.exports = AnnouncementService
