const { callFunction } = require('./api')

const LEGACY_ROUTE_MAP = {
  '/pages/student/task-manage/task-detail/task-detail': '/subpackages/student/task-manage/task-detail/task-detail',
  '/pages/student/task-manage/submission-edit/submission-edit': '/subpackages/student/task-manage/submission-edit/submission-edit',
  '/pages/student/task-manage/submission-records/submission-records': '/subpackages/student/task-manage/submission-records/submission-records',
  '/pages/student/class-manage/class-detail/class-detail': '/subpackages/student/class-manage/class-detail/class-detail',
  '/pages/student/class-manage/join-confirm/join-confirm': '/subpackages/student/class-manage/join-confirm/join-confirm',
  '/pages/student/points-log/points-log': '/subpackages/student/points-log/points-log',
  '/pages/student/lottery/lottery': '/subpackages/student/lottery/lottery',
  '/pages/student/lottery/draw-records/draw-records': '/subpackages/student/lottery/draw-records/draw-records',
  '/pages/teacher/class-manage/class-detail/class-detail': '/subpackages/teacher/class-manage/class-detail/class-detail',
  '/pages/teacher/class-manage/class-edit/class-edit': '/subpackages/teacher/class-manage/class-edit/class-edit',
  '/pages/teacher/task-manage/task-detail/task-detail': '/subpackages/teacher/task-manage/task-detail/task-detail',
  '/pages/teacher/task-manage/task-edit/task-edit': '/subpackages/teacher/task-manage/task-edit/task-edit',
  '/pages/common/announcements/announcements': '/subpackages/common/announcements/announcements'
}

class AnnouncementService {
  static resolveActionUrl(actionUrl = '') {
    const url = String(actionUrl || '').trim()
    if (!url) {
      return ''
    }

    const normalizedUrl = url.startsWith('/') ? url : `/${url}`
    const [baseUrl, ...queryParts] = normalizedUrl.split('?')
    const mappedBaseUrl = LEGACY_ROUTE_MAP[baseUrl] || baseUrl
    const queryText = queryParts.join('?')
    return queryText ? `${mappedBaseUrl}?${queryText}` : mappedBaseUrl
  }

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
    const normalizedUrl = this.resolveActionUrl(announcement.action_url)
    if (!normalizedUrl) {
      return false
    }

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
