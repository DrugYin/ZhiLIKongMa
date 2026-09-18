const { rankingApi } = require('./api')

class RankingService {
  static async getRanking(params = {}) {
    const res = await rankingApi.getRanking(params)
    if (!res.success) {
      throw new Error(res.message || '获取排行榜失败')
    }
    return res.data
  }

  static async getCurrentUserRanking(rankType = 'week') {
    return this.getRanking({
      rank_type: rankType,
      current_user_only: true,
      page: 1,
      page_size: 1
    })
  }
}

module.exports = RankingService
