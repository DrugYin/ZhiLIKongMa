# 阶段六：积分与抽奖系统 — 开发计划

**创建日期**: 2026-05-14
**状态**: 规划完成，待实现

---

## 一、现状分析

### 1.1 已具备的基础设施

| 模块 | 状态 | 说明 |
|------|------|------|
| 积分累计 | ✅ | `review-submission` 审核通过时发放积分 |
| 积分明细 | ✅ | `get-points-log` 云函数 + `student/points-log` 页面 |
| 积分存储 | ✅ | `users.points` / `users.total_points` 字段 |
| 配置定义 | ✅ | `lottery_enabled`、`lottery_cost_points`、`lottery_daily_limit` 已在 `system_config` |
| API 占位 | ✅ | `api.js` 中 `lotteryApi.getPrizes/startDraw/getDrawRecords` 已声明 |
| DB Schema | ✅ | `prizes`、`draw_records` 表设计已在开发文档中定义 |
| get-config | ✅ | 已补齐，可读取系统配置 |

### 1.2 缺失项

| 模块 | 状态 | 优先级 |
|------|------|--------|
| `get-prizes` 云函数 | ⬜ | P0 |
| `start-draw` 云函数 | ⬜ | P0 |
| `get-draw-records` 云函数 | ⬜ | P1 |
| 抽奖主页面 | ⬜ | P0 |
| 抽奖转盘组件 | ⬜ | P0 |
| 抽奖记录页面 | ⬜ | P1 |
| 后台奖品管理云函数 | ⬜ | P1 |
| 后台奖品管理页面 | ⬜ | P1 |
| `prizes` 集合 | ⬜ | P0 |
| `draw_records` 集合 | ⬜ | P0 |

---

## 二、阶段目标

实现完整的积分消费与抽奖功能：
- 学生可使用积分抽奖，消耗可配置的积分
- 基于概率百分比的奖品随机分配
- 每日抽奖次数限制（通过 `lottery_daily_limit` 配置）
- 奖品库存自动扣减
- 抽奖记录可追溯

---

## 三、已确认决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 转盘实现方式 | **Canvas 2D** |
| 2 | 概率算法 | **probability 百分比** |
| 3 | 事务方案 | **云开发原生事务** |
| 4 | 奖品图片 | **云存储上传** |
| 5 | 后台管理 | **独立 admin-manage-prizes** |
| 6 | 抽奖入口 | **学生首页快捷入口** |

---

## 四、任务分解

### 阶段 6.1：云函数（3 个）

#### 6.1.1 `get-prizes` 云函数
- **功能**: 返回所有 `status: 'active'` 且 `stock > 0` 的奖品列表
- **输入**: 无
- **输出**: `{ success, data: { prizes: [...], total } }`
- **权限**: 所有已登录用户

#### 6.1.2 `start-draw` 云函数（核心）
- **流程**:
  1. 验证用户登录 + 学生角色
  2. 检查 `lottery_enabled` 配置
  3. 检查用户积分 >= `lottery_cost_points`
  4. 检查今日抽奖次数 < `lottery_daily_limit`
  5. 查询可用奖品（`stock > 0` 且 `status: 'active'`）
  6. 按 `probability` 百分比计算中奖
  7. **事务**: 扣积分 + 扣库存 + 写 `draw_records` + 写 `points_log`
  8. 返回中奖结果
- **输入**: 无
- **输出**: `{ success, data: { prize, points_before, points_after } }`

#### 6.1.3 `get-draw-records` 云函数
- **功能**: 分页查询当前用户的抽奖记录
- **输入**: `{ page, page_size }`
- **输出**: `{ success, data: { list, total, has_more } }`

### 阶段 6.2：前端（2 页面 + 1 组件）

#### 6.2.1 抽奖转盘组件 `lottery-wheel`
- Canvas 2D 绘制扇形转盘
- 属性: `prizes`（奖品列表）, `disabled`
- 事件: `bind:result`

#### 6.2.2 抽奖主页面 `student/lottery/lottery`
- 顶部积分显示 + 今日剩余次数
- 中部转盘组件
- 抽奖按钮（消耗积分提示）
- 状态: 关闭/积分不足/次数用尽/加载中

#### 6.2.3 抽奖记录页 `student/lottery/draw-records`
- 历史列表，分页加载

### 阶段 6.3：后台管理（1 云函数 + 1 页面）

#### 6.3.1 `admin-manage-prizes` + `PrizesPage.vue`

### 阶段 6.4：接入与联调

---

## 五、文件清单

### 新建文件

```
cloudfunctions/
├── get-prizes/
│   ├── index.js
│   └── package.json
├── start-draw/
│   ├── index.js
│   └── package.json
├── get-draw-records/
│   ├── index.js
│   └── package.json
└── admin-manage-prizes/
    ├── index.js
    └── package.json

miniprogram/
├── components/
│   └── lottery-wheel/
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
└── pages/student/
    └── lottery/
        ├── lottery.js
        ├── lottery.json
        ├── lottery.wxml
        ├── lottery.wxss
        ├── draw-records.js
        ├── draw-records.json
        ├── draw-records.wxml
        └── draw-records.wxss

admin-web/src/
├── api/
│   └── prizes.js
└── pages/
    └── prizes/
        └── PrizesPage.vue
```

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `miniprogram/app.json` | 注册抽奖页面路由 |
| `miniprogram/pages/student/index.js` | 添加快捷入口跳转抽奖页 |
| `admin-web/src/router/index.js` | 添加奖品管理路由 |
| `admin-web/src/layouts/AdminLayout.vue` | 侧边栏添加奖品管理菜单 |

---

## 六、验收标准

- [ ] 抽奖可通过 `lottery_enabled` 配置开关
- [ ] 积分不足时拒绝抽奖，前端明确提示
- [ ] 每日次数限制通过 `lottery_daily_limit` 生效
- [ ] 每次扣积分通过 `lottery_cost_points` 配置
- [ ] 中奖按 `probability` 百分比分布
- [ ] 库存归零后不再被抽中
- [ ] 全部库存归零时按钮置灰
- [ ] 抽奖记录正确保存
- [ ] 积分明细包含 `lottery_cost` 记录
- [ ] 后台可管理奖品（CRUD）
- [ ] 转盘动画流畅

---

## 七、预计工期

| 子阶段 | 内容 | 工期 |
|--------|------|------|
| 6.1 | 云函数 | 3 天 |
| 6.2 | 前端 | 3 天 |
| 6.3 | 后台 | 1.5 天 |
| 6.4 | 联调 | 1 天 |
| **合计** | | **8.5 天** |

---

**计划版本**: v1.1
**下一步**: 从阶段 6.1 开始实现
