const { overviewApi } = require('./api')

class OverviewService {
  static async getStudentOverview() {
    const res = await overviewApi.getStudentOverview()
    if (!res.success) {
      throw new Error(res.message || '获取学生首页数据失败')
    }
    return res.data || {}
  }

  static async getTeacherOverview() {
    const res = await overviewApi.getTeacherOverview()
    if (!res.success) {
      throw new Error(res.message || '获取教师首页数据失败')
    }
    return res.data || {}
  }

  static async getTeacherReviews(params = {}) {
    const res = await overviewApi.getTeacherReviews(params)
    if (!res.success) {
      const error = new Error(res.message || '获取教师审核记录失败')
      error.code = res.error_code
      throw error
    }
    return res.data || {}
  }
}

module.exports = OverviewService
