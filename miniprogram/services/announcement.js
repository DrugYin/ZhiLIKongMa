const { callFunction } = require('./api')

class AnnouncementService {
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
}

module.exports = AnnouncementService
