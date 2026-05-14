# 阶段六：积分与抽奖系统 — 开发计划

**创建日期**: 2026-05-14
**状态**: 规划中

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

### 1.2 缺失项

| 模块 | 状态 | 优先级 |
|------|------|--------|
| `get-prizes` 云函数 | ⬜ | P0 |
| `start-draw` 云函数 | ⬜ | P0 |
| `get-draw-records` 云函数 | ⬜ | P1 |
| 抽奖主页面 | ⬜ | P0 |
| 抽奖转盘组件 | ⬜ | P0 |
| 抽奖记录页面 | ⬜ | P1 |
| 后台奖品管理 | ⬜ | P1 |
| `prizes` 集合初始化 | ⬜ | P0 |
| `draw_records` 集合 | ⬜ | P0 |

---

## 二、阶段目标

实现完整的积分消费与抽奖功能：
- 学生可使用积分抽奖，消耗可配置的积分
- 基于概率/权重的奖品随机分配
- 每日抽奖次数限制
- 奖品库存自动管理
- 抽奖记录可追溯
- 教师/管理员可通过后台管理奖品

---

## 三、任务分解

### 阶段 6.1：数据库与云函数（预计 3 天）

#### 6.1.1 数据库初始化
| 任务 | 说明 | 产出 |
|------|------|------|
| 创建 `prizes` 集合 | 含默认示例奖品（3-5 个） | 集合 + 索引 |
| 创建 `draw_records` 集合 | 空集合，运行时写入 | 集合 + 索引 |
| 确认 `system_config` 抽奖配置 | `lottery_enabled/cost_points/daily_limit` 已存在 | 验证 |

#### 6.1.2 `get-prizes` 云函数
- **功能**: 返回所有启用状态（`status: active`）的奖品列表
- **输入**: 无
- **输出**: `{ prizes: [...], total: N }`
- **权限**: 所有已登录用户

#### 6.1.3 `start-draw` 云函数（核心）
- **功能**: 执行一次抽奖操作
- **流程**:
  1. 验证用户登录态与角色（学生）
  2. 检查 `lottery_enabled` 配置
  3. 检查用户积分是否足够（`lottery_cost_points`）
  4. 检查每日抽奖次数是否超限（`lottery_daily_limit`）
  5. 查询可用奖品列表（库存 > 0）
  6. 按权重计算中奖结果
  7. 扣减用户积分 + 记录积分日志（`points_log`，type=`lottery_cost`）
  8. 扣减奖品库存（原子操作）
  9. 写入 `draw_records`
  10. 返回中奖结果
- **输入**: 无（或可选指定奖品池）
- **输出**: `{ prize: {...}, points_before, points_after }`
- **关键**: 使用数据库事务保证积分扣减 + 库存扣减的原子性

#### 6.1.4 `get-draw-records` 云函数
- **功能**: 返回当前用户的抽奖记录分页列表
- **输入**: `{ page, page_size }`
- **输出**: `{ list: [...], total, has_more }`
- **权限**: 仅查询自己的记录

### 阶段 6.2：前端页面与组件（预计 3 天）

#### 6.2.1 抽奖转盘组件 `lottery-wheel`
- 基于 Canvas 的旋转转盘（TDesign 无内置转盘组件）
- 支持动态设置奖品列表（从 API 获取）
- 旋转动画 + 结果回调
- 属性: `prizes`（奖品列表）, `disabled`（是否可抽）
- 事件: `bind:result`（抽奖结果）

#### 6.2.2 抽奖主页面 `student/lottery/lottery`
- 顶部：用户当前积分显示
- 中部：抽奖转盘组件
- 底部：抽奖按钮（显示消耗积分数 / 今日剩余次数）
- 状态处理：
  - 抽奖关闭：显示"抽奖暂未开放"
  - 积分不足：按钮置灰 + 提示
  - 次数用尽：按钮置灰 + "今日次数已用完"
  - 加载中：按钮 loading
- 中奖弹窗：展示奖品图片/名称 + 动画

#### 6.2.3 抽奖记录页面 `student/lottery/draw-records`
- 抽奖历史列表（时间、奖品名、消耗积分、状态）
- 分页加载
- 空状态提示

#### 6.2.4 积分明细页面更新
- `points-log` 页面已存在，确认是否需添加 `lottery_cost` 类型的筛选

### 阶段 6.3：后台管理（预计 1.5 天）

#### 6.3.1 后台奖品管理云函数 `admin-manage-prizes`
- 参照 `admin-manage-config` 模式
- 操作: `list` / `get` / `create` / `update` / `delete` / `toggle_status`
- 字段: `name`, `image`, `type`, `stock`, `probability`, `weight`, `value`, `status`, `sort_order`

#### 6.3.2 后台奖品管理页面
- 奖品列表（表格 + 搜索 + 状态筛选）
- 新增/编辑弹窗
- 库存管理
- 删除确认

### 阶段 6.4：联调与验证（预计 1 天）

#### 6.4.1 端到端测试场景
- [ ] 正常抽奖流程（积分充足、有库存）
- [ ] 积分不足时拒绝抽奖
- [ ] 每日次数用尽后拒绝
- [ ] 奖品库存为 0 时不参与抽奖
- [ ] 全部库存为 0 时抽奖不可用
- [ ] 中奖概率符合权重配置（抽 100 次统计）
- [ ] 抽奖记录正确展示
- [ ] 积分明细正确记录抽奖消耗

---

## 四、文件清单

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
│   └── prizes.js              # 后台奖品 API 封装
└── pages/
    └── prizes/
        └── PrizesPage.vue      # 后台奖品管理页
```

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `miniprogram/app.json` | 注册抽奖页面路由 |
| `miniprogram/custom-tab-bar/index.js` | 可选：在学生 TabBar 添加抽奖入口 |
| `miniprogram/pages/student/index.js` | 添加快捷入口跳转抽奖页 |
| `admin-web/src/router/index.js` | 添加奖品管理路由 |
| `admin-web/src/layouts/AdminLayout.vue` | 侧边栏添加奖品管理菜单 |

---

## 五、关键决策点

| # | 决策 | 选项 | 建议 |
|---|------|------|------|
| 1 | 抽奖转盘实现方式 | A) Canvas 2D 手写 B) 纯 CSS 动画 | A，更灵活可控 |
| 2 | 抽奖概率算法 | A) 按 `weight` 权重 B) 按 `probability` 百分比 | A，与 DB schema 一致 |
| 3 | 是否使用数据库事务 | A) 云开发事务 B) 乐观锁 | A，积分+库存需原子性 |
| 4 | 奖品图片 | A) 云存储上传 B) URL 输入 | A，与其他模块一致 |
| 5 | 后台奖品管理 | A) 独立 admin-manage-prizes B) 复用 admin-manage-config | A，奖品有图片/库存等特殊字段 |
| 6 | 抽奖入口位置 | A) 学生首页快捷入口 B) TabBar 独立 tab C) 我的页面内 | 待确认 |

---

## 六、验收标准

- [ ] 抽奖功能可通过 `lottery_enabled` 配置开关
- [ ] 积分不足时无法抽奖，前端给予明确提示
- [ ] 每日抽奖次数限制生效（通过 `lottery_daily_limit` 配置）
- [ ] 每次抽奖扣除积分数可配置（`lottery_cost_points`）
- [ ] 中奖结果按权重随机分布
- [ ] 奖品库存归零后不再被抽中
- [ ] 全部奖品库存归零后抽奖按钮置灰
- [ ] 抽奖记录正确保存，含奖品信息、消耗积分、时间
- [ ] 积分明细中可查到 `lottery_cost` 类型记录
- [ ] 后台可增删改查奖品
- [ ] 转盘动画流畅（60fps）

---

## 七、预计工期

| 子阶段 | 内容 | 工期 |
|--------|------|------|
| 6.1 | 数据库 + 云函数 | 3 天 |
| 6.2 | 前端页面 + 组件 | 3 天 |
| 6.3 | 后台管理 | 1.5 天 |
| 6.4 | 联调验证 | 1 天 |
| **合计** | | **8.5 天** |

---

**计划版本**: v1.0
**下一步**: 确认关键决策点后开始实现
