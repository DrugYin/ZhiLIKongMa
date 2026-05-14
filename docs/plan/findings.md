# 阶段六：积分与抽奖系统 — 调研发现

**创建日期**: 2026-05-14

---

## 1. 现有基础设施调研

### 1.1 积分相关
- **积分发放**: `cloudfunctions/review-submission/index.js` 审核通过时写入 `users.points` 和 `users.total_points`，同时写入 `points_log` 集合
- **积分明细**: `cloudfunctions/get-points-log/index.js` 分页查询 `points_log`，支持 type 筛选
- **积分明细页**: `miniprogram/pages/student/points-log/` 四件套已存在
- **积分字段**: `users.points`（当前积分）、`users.total_points`（累计积分）

### 1.2 抽奖配置
- `system_config` 中已定义三个抽奖配置键：
  - `lottery_enabled` = true（功能开关）
  - `lottery_cost_points` = 10（单次消耗积分）
  - `lottery_daily_limit` = 5（每日次数上限）
- 这些配置在 `admin-manage-config` 和 `config/project.js` 中均已定义，但尚无业务逻辑使用

### 1.3 API 层
- `miniprogram/services/api.js` 中 `lotteryApi` 已声明三个方法：
  ```js
  getPrizes() → callFunction({ name: 'get-prizes' })
  startDraw() → callFunction({ name: 'start-draw' })
  getDrawRecords(data) → callFunction({ name: 'get-draw-records', data })
  ```
- 但三个云函数均未实现

### 1.4 数据库 Schema
- `prizes` 集合设计已完成（`docs/DEVELOPMENT_PLAN.md` 第 733-758 行）
- `draw_records` 集合设计已完成（`docs/DEVELOPMENT_PLAN.md` 第 759-781 行）
- 两个集合目前均未在数据库中创建

### 1.5 后台管理端
- 后台管理端 12 个页面均已完成，但不含奖品管理
- `admin-web/src/pages/points-log/PointsLogPage.vue` 已有 `lottery_cost` 的筛选选项和标签

---

## 2. 技术方案调研

### 2.1 抽奖转盘实现
微信小程序中 Canvas 2D 是唯一可靠的转盘实现方式：
- TDesign Mini 无内置转盘组件
- Canvas 2D API 支持基础库 2.9.0+（本项目基础库 3.0+）
- 参考实现：基于扇区绘制 + `requestAnimationFrame` 旋转动画
- 纯 CSS 方案不可靠（小程序对 CSS transform origin 支持有限）

### 2.2 概率算法
采用权重（weight）累加算法：
1. 将所有可用奖品按 weight 求和得到 totalWeight
2. 生成 [0, totalWeight) 随机数
3. 遍历奖品累加 weight，找到命中区间
4. 复杂度 O(n)，奖品数量少时性能可接受

### 2.3 数据库事务
云开发支持 `startTransaction` / `commitTransaction` / `rollbackTransaction`：
```js
const transaction = await db.startTransaction()
try {
  // 扣积分
  await transaction.collection('users').doc(uid).update({...})
  // 扣库存
  await transaction.collection('prizes').doc(pid).update({...})
  // 写记录
  await transaction.collection('draw_records').add({...})
  await transaction.commit()
} catch (e) {
  await transaction.rollback()
}
```
这是保证积分扣减 + 库存扣减原子性的关键。

### 2.4 每日次数限制
方案：在 `draw_records` 中按 `student_openid + 当日 00:00~23:59` 查询 count。
- 优点：无需额外字段，数据一致性好
- 性能：`draw_records` 需建立 `student_openid + create_time` 复合索引

### 2.5 积分日志接入
抽奖消耗积分时写入 `points_log`：
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
与现有 `get-points-log` 云函数的 type 筛选兼容。
