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
}

module.exports = OverviewService
