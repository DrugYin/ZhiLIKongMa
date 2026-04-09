const { rankingApi } = require('./api')

class RankingService {
  static async getRanking(params = {}) {
    const res = await rankingApi.getRanking(params)
    if (!res.success) {
      throw new Error(res.message || '获取排行榜失败')
    }
    return res.data
  }
}

module.exports = RankingService
