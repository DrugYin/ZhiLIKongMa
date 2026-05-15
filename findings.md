# 阶段六：积分与抽奖系统 — 调研发现

**创建日期**: 2026-05-14

---

## 1. 现有基础设施

- **积分发放**: `review-submission` 审核通过时写入 `users.points/total_points` + `points_log`
- **积分明细**: `get-points-log` 云函数 + `student/points-log/` 页面（已存在）
- **API 占位**: `lotteryApi.getPrizes/startDraw/getDrawRecords` 已在 `api.js` 声明
- **DB Schema**: `prizes`、`draw_records` 已在开发文档定义
- **配置**: `lottery_enabled/cost_points/daily_limit` 已在 `system_config` 定义
- **get-config**: 已补齐，可用 `projectService.getConfig()` 读取配置

## 2. 技术选型

| 问题 | 选择 | 原因 |
|------|------|------|
| 转盘实现 | Canvas 2D | 小程序 CSS transform-origin 支持有限 |
| 概率算法 | probability 百分比 | 直观易配置 |
| 原子性 | 云开发原生事务 | 积分+库存+记录需原子操作 |
| 奖品图片 | 云存储上传 | 与项目已有模式一致 |
| 后台管理 | 独立 admin-manage-prizes | 奖品有图片/库存等特殊字段 |
| 抽奖入口 | 学生首页快捷入口 | 不改 TabBar 结构 |

## 3. 概率算法

按 `probability` 百分比（0-1）：
1. 过滤可用奖品（`stock > 0`, `status: 'active'`）
2. 归一化所有 probability 使总和为 1
3. 生成 [0, 1) 随机数
4. 累加 probability 找到命中区间
5. 复杂度 O(n)，奖品少时足够

## 4. 每日次数限制

查询 `draw_records` 中 `student_openid + 当日 00:00~23:59` 的 count。需复合索引。

## 5. 积分日志

```js
{
  student_openid: 'xxx',
  type: 'lottery_cost',
  amount: -10,
  before_points: 100,
  after_points: 90,
  related_id: drawRecordId,
  description: '抽奖消耗',
  create_time: Date
}
```

与现有 `get-points-log` 的 type 筛选兼容。
