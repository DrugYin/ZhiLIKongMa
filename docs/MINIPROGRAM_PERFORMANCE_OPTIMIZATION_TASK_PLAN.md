# 小程序性能优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 在不改变学生、教师现有业务能力的前提下，减少首页与审核中心的云函数调用次数、降低核心接口耗时、控制主包体积，并建立可重复的性能验收基线。

**架构：** 采用“页面聚合接口 + 精简列表载荷 + 匹配查询的复合索引 + 非 Tab 页面分包”方案。学生首页、教师首页和教师审核中心分别由一个面向页面的云函数返回首屏所需数据；通用详情接口继续保留，避免为了首屏展示拉取完整历史记录。

**技术栈：** 微信小程序 JavaScript、TDesign Mini、CloudBase 云函数、CloudBase 文档数据库、Node.js `assert` 测试。

**规格依据：** 本文“1. 性能基线与验收目标”章节，以及 2026-09-17 对当前仓库和线上 CloudBase 监控的只读审计结果。

## 全局约束

- 保持微信小程序基础库 `3.14.2` 兼容，不引入新的前端运行时依赖。
- 保持现有 `student`、`teacher`、`admin` 权限边界；所有跨用户数据读取继续放在云函数中。
- 保留当前云函数响应规范：`{ success, message, data, error_code }`。
- 列表接口默认 `page_size=20`，单次最大值不超过 `50`。
- 首页不得为了统计数字拉取完整任务、提交或申请文档。
- 新增和调整索引前先只读核对线上索引；索引变更后回读确认。
- 每项代码变更都先补失败测试，再实现，再运行相关测试与全量测试。
- 提交信息使用规范的简体中文内容，每个任务独立提交。
- 不修改现有业务文案、审核规则、积分规则和排行榜口径。

---

## 1. 性能基线与验收目标

### 1.1 当前基线

监控区间：2026-09-16 13:30 至 2026-09-17 13:30。耗时为 CloudBase 在有调用时的每小时平均值，不等同于单次请求 P95。

| 指标 | 当前值 |
|---|---:|
| 云函数调用总量 | 约 484 次/24小时 |
| 云函数错误 | 0 |
| 云函数超时 | 0 |
| 云函数限流 | 0 |
| `get-announcements` | 671～794ms |
| `get-tasks` | 311～434ms |
| `get-submissions` | 225～357ms |
| `get-classes` | 205～293ms |
| `get-my-class-status` | 约 289ms |
| `get-user-info` | 78～223ms |
| `get-ranking` | 约 199ms |
| `get-class-applications` | 158～175ms |

当前代码目录粗算：

| 项目 | 当前值 |
|---|---:|
| 页面数 | 25 |
| 分包数 | 0 |
| 第一方小程序文件 | 668,580 bytes |
| `miniprogram_npm` | 1,277,173 bytes |
| 合计源码体积 | 1,945,753 bytes |

### 1.2 调用次数基线

- 已登录学生进入首页：通常 7～10 次云函数调用。
- 教师首页：最低约 `6 + 班级数` 次调用；提交或申请超过一页后继续增加。
- 教师审核中心首次加载：通常约 `6 + 5 × 班级数` 次调用。

### 1.3 最终验收目标

| 指标 | 目标 |
|---|---:|
| 已登录学生首页首轮云函数调用 | 不超过 2 次 |
| 教师首页首轮云函数调用 | 不超过 2 次 |
| 教师审核中心首屏调用 | 1 次，且不随班级数线性增加 |
| `get-announcements` 活跃时段平均耗时 | 不高于 400ms |
| 首页聚合云函数活跃时段平均耗时 | 不高于 500ms |
| 教师审核聚合云函数活跃时段平均耗时 | 不高于 600ms |
| 核心云函数错误、超时、限流 | 均为 0 |
| 开发者工具显示的主包体积 | 不高于 1.5MiB |
| 学生首页初始化 P75 | 不高于 1.5s |
| 教师首页初始化 P75 | 不高于 1.8s |
| 教师审核中心初始化 P75 | 不高于 1.5s |

页面 P75 使用同一台真机、同一网络、同一生产环境连续测试 20 次；首个冷启动样本单独记录，不计入热启动 P75。测试报告必须记录设备型号、微信版本、基础库版本和网络类型。

### 1.4 非目标

- 本轮不重做页面视觉设计。
- 本轮不迁移数据库类型，不引入关系型数据库。
- 本轮不修改积分、抽奖、排行榜计算规则。
- 本轮不优化管理后台 Web 首屏。

---

## 2. 目标文件结构

### 2.1 新增文件

```text
cloudfunctions/
├── get-student-overview/
│   ├── index.js
│   └── package.json
├── get-teacher-overview/
│   ├── index.js
│   └── package.json
└── get-teacher-reviews/
    ├── index.js
    └── package.json

miniprogram/services/
└── overview.js

tests/
├── miniprogram-performance-contract.test.js
├── student-overview.test.js
├── teacher-overview.test.js
└── teacher-reviews.test.js
```

### 2.2 重点修改文件

```text
miniprogram/app.js
miniprogram/app.json
miniprogram/services/api.js
miniprogram/pages/student/index.js
miniprogram/pages/teacher/index.js
miniprogram/pages/teacher/pending/pending.js
miniprogram/pages/student/rank/rank.js
cloudfunctions/get-announcements/index.js
cloudfunctions/get-tasks/index.js
cloudfunctions/get-submissions/index.js
cloudfunctions/get-ranking/index.js
tests/phase4-efficiency.test.js
tests/phase5-cleanup.test.js
```

### 2.3 接口边界

#### `get-student-overview`

输入：

```js
{}
```

输出 `data`：

```js
{
  user_info: {},
  class_summary: {
    joined_count: 0,
    pending_count: 0
  },
  weekly_rank: {
    rank: 0,
    text: '未上榜'
  },
  weekly_task: {
    total: 0,
    submitted: 0,
    latest_pending_task: null
  }
}
```

#### `get-teacher-overview`

输入：

```js
{}
```

输出 `data`：

```js
{
  user_info: {},
  overview: {
    class_count: 0,
    task_count: 0,
    student_count: 0,
    pending_submission_count: 0,
    pending_application_count: 0
  },
  weekly_stats: {
    submitted_student_count: 0,
    completion_rate: 0
  },
  recent_activities: []
}
```

#### `get-teacher-reviews`

输入：

```js
{
  type: 'all',
  status: 'all',
  class_id: '',
  cursor: '',
  page_size: 20,
  include_stats: true
}
```

输出 `data`：

```js
{
  list: [],
  page_size: 20,
  total: 0,
  has_more: false,
  next_cursor: '',
  class_options: [],
  stats: {
    total: 0,
    pending: 0,
    task_pending: 0,
    join_pending: 0,
    approved: 0,
    rejected: 0
  }
}
```

---

## 3. 实施阶段总览

| 阶段 | 内容 | 优先级 | 预计工作量 |
|---|---|---:|---:|
| 第一阶段 | 性能基线、首页聚合、审核中心聚合 | P0 | 3～4人日 |
| 第二阶段 | 公告、载荷、索引优化 | P1 | 2～3人日 |
| 第三阶段 | 分包、渲染和真机验收 | P2 | 2～3人日 |
| 合计 | 开发、部署与验证 |  | 7～10人日 |

---

## 4. 详细任务

### 任务 1：建立性能回归基线并清理过期测试

**优先级：** P0

**文件：**

- 新建：`tests/miniprogram-performance-contract.test.js`
- 修改：`tests/phase4-efficiency.test.js`
- 修改：`tests/phase5-cleanup.test.js`

**接口：**

- 输入：仓库当前源码与 `miniprogram/app.json`。
- 输出：请求聚合、分包、公告裁剪和审核中心聚合的静态契约测试。

- [x] **步骤 1：修正两组已经失效的历史断言**

  `phase4-efficiency.test.js` 不再要求已经移除的 `const LIMIT = 200`，改为验证后台抽奖记录使用服务端 `count + orderBy + skip + limit` 分页。

  `phase5-cleanup.test.js` 不再要求已经移除的 `getProperty(source, paths)`，改为验证 `normalizeTempFileURLResponse`、`pickFirst` 和临时 URL 缓存仍然存在。

- [x] **步骤 2：新增性能契约测试并先验证失败**

```js
const assert = require('assert')
const fs = require('fs')

const appJson = JSON.parse(fs.readFileSync('miniprogram/app.json', 'utf8'))
const studentHome = fs.readFileSync('miniprogram/pages/student/index.js', 'utf8')
const teacherHome = fs.readFileSync('miniprogram/pages/teacher/index.js', 'utf8')
const pendingPage = fs.readFileSync('miniprogram/pages/teacher/pending/pending.js', 'utf8')

assert.ok(Array.isArray(appJson.subpackages) && appJson.subpackages.length >= 2)
assert.match(studentHome, /OverviewService\.getStudentOverview/)
assert.match(teacherHome, /OverviewService\.getTeacherOverview/)
assert.match(pendingPage, /OverviewService\.getTeacherReviews/)
assert.doesNotMatch(pendingPage, /targetClasses\.map\(c => buildAppPromise/)
```

- [x] **步骤 3：逐个运行现有测试，保存真实基线**

```powershell
Get-ChildItem tests -Filter '*.test.js' | Sort-Object Name | ForEach-Object { node $_.FullName }
```

  预期：历史测试全部通过；新性能契约测试因为聚合接口与分包尚未实现而失败。

- [ ] **步骤 4：记录开发者工具与真机基线**

  对学生首页、教师首页、教师审核中心分别测试 20 次，记录：页面初始化时间、云函数调用数、首屏 `setData` 次数、主包体积。结果追加到本文件“6. 验收记录”。

- [x] **步骤 5：提交**

```bash
git add tests/phase4-efficiency.test.js tests/phase5-cleanup.test.js tests/miniprogram-performance-contract.test.js docs/MINIPROGRAM_PERFORMANCE_OPTIMIZATION_TASK_PLAN.md
git commit -m "test: 更新性能回归基线"
```

### 任务 2：新增学生首页聚合接口

**优先级：** P0

**文件：**

- 新建：`cloudfunctions/get-student-overview/index.js`
- 新建：`cloudfunctions/get-student-overview/package.json`
- 新建：`tests/student-overview.test.js`
- 修改：`miniprogram/services/api.js`
- 新建：`miniprogram/services/overview.js`
- 修改：`miniprogram/pages/student/index.js`

**接口：**

- 消费：`/opt/auth`、`/opt/membership`、`/opt/response`。
- 产出：`OverviewService.getStudentOverview()`，返回第 2.3 节定义的学生首页数据。

- [x] **步骤 1：为聚合结果写失败测试**

```js
const assert = require('assert')
const source = require('fs').readFileSync('cloudfunctions/get-student-overview/index.js', 'utf8')

assert.match(source, /ranking_snapshots/)
assert.match(source, /latest_pending_task/)
assert.match(source, /submitted/)
assert.doesNotMatch(source, /getAllUsers/)
```

  运行：`node tests/student-overview.test.js`

  预期：失败，提示目标文件不存在。

- [x] **步骤 2：实现 `get-student-overview`**

  一次读取当前用户；一次读取其有效班级关系；直接读取 `ranking_snapshots/week`；只查询当前周、当前用户已加入班级的已发布任务；只查询这些任务 ID 对应的当前学生提交记录。任务和提交查询必须使用 `.field()`，不得返回附件正文。

- [x] **步骤 3：新增服务层入口**

```js
const OverviewService = {
  getStudentOverview() {
    return callFunction({ name: 'get-student-overview' })
  }
}
```

  `miniprogram/services/overview.js` 负责检查 `success` 并返回 `res.data`，页面不得直接解析底层 CloudBase 响应。

- [x] **步骤 4：替换学生首页瀑布请求**

  删除首页对 `get-user-info`、`get-my-class-status`、`get-ranking`、`get-tasks`、`get-submissions` 的独立调用。保留本地缓存用于首帧占位，聚合接口返回后一次更新首页主体数据。

- [x] **步骤 5：取消启动阶段的重复用户刷新**

  `app.js` 在已有有效本地用户信息时不再阻塞页面等待 `get-user-info`；教师角色跳转先读取本地角色，聚合接口返回后再校正缓存。未注册用户仍走现有 `login + get-user-info` 流程。

- [x] **步骤 6：运行测试**

```powershell
node tests/student-overview.test.js
node tests/miniprogram-performance-contract.test.js
node tests/miniprogram-constants.test.js
```

  预期：学生聚合测试通过；性能契约测试只剩尚未实施的教师聚合和分包断言失败。

- [ ] **步骤 7：部署并回读验证**

  使用 CloudBase MCP 部署 `get-student-overview`，再查询函数详情确认运行时、层绑定与超时配置。用学生账号验证未加入班级、存在待审核申请、已加入多个班级、本周无任务、本周任务已全部提交五种场景。

  > 2026-09-18 部署进度：函数已创建并回读为 `Active / Available`，运行时 `Nodejs18.15`、超时 20 秒、内存 256MB，已绑定 `shared` 第 11 版。无微信身份的空调用稳定返回业务 `401`，未访问用户集合；五种真实学生场景仍需在体验版中验收。

  > 体验反馈与监控：用户扫码测试后反馈未发现明显问题，加载速度较优化前明显提升。最近一小时监控中 `FunctionDuration` 平均 49.39ms、最大 189ms，`FunctionError` 为 0；这些是 5 分钟聚合监控样本，不替代五种场景逐项验收或 P75。

- [x] **步骤 8：提交**

```bash
git add cloudfunctions/get-student-overview miniprogram/app.js miniprogram/services/api.js miniprogram/services/overview.js miniprogram/pages/student/index.js tests/student-overview.test.js
git commit -m "性能: 合并学生首页数据请求"
```

### 任务 3：新增教师首页聚合接口

**优先级：** P0

**文件：**

- 新建：`cloudfunctions/get-teacher-overview/index.js`
- 新建：`cloudfunctions/get-teacher-overview/package.json`
- 新建：`tests/teacher-overview.test.js`
- 修改：`miniprogram/services/api.js`
- 修改：`miniprogram/services/overview.js`
- 修改：`miniprogram/pages/teacher/index.js`

**接口：**

- 消费：教师身份、班级、任务、提交和入班申请集合。
- 产出：`OverviewService.getTeacherOverview()`，返回第 2.3 节定义的教师首页数据。

- [x] **步骤 1：写失败测试**

```js
const assert = require('assert')
const source = require('fs').readFileSync('cloudfunctions/get-teacher-overview/index.js', 'utf8')

assert.match(source, /pending_submission_count/)
assert.match(source, /pending_application_count/)
assert.match(source, /recent_activities/)
assert.doesNotMatch(source, /page <= 10/)
assert.doesNotMatch(source, /list\.push\(\.\.\.currentList\)/)
```

- [x] **步骤 2：实现教师统计查询**

  使用数据库 `count()` 或聚合查询得到班级数、任务数、待审核提交数和本周已提交学生数。班级只投影 `_id`、`class_name`、`member_count`、`update_time`；最近动态每种数据源最多读取 1 条，禁止读取 500 条提交后在前端计数。

- [x] **步骤 3：批量统计入班申请**

  将教师班级 ID 按 20 个一组，通过 `class_id: _.in(batchIds)` 查询待审核申请总数和最新一条申请。数据库操作数应与“班级批次数”相关，不得与单个班级数一一对应。

- [x] **步骤 4：替换教师首页请求**

  删除 `fetchAllTeacherSubmissions`、`fetchAllPendingApplications`、`fetchClassPendingApplications`、`fetchAllClasses` 和 `fetchAllTasks`。页面只调用 `OverviewService.getTeacherOverview()`，公告仍独立懒加载。

- [x] **步骤 5：运行测试并验证降级状态**

```powershell
node tests/teacher-overview.test.js
node tests/miniprogram-performance-contract.test.js
```

  模拟排行榜或最近动态缺失时，首页统计仍应正常展示；接口失败时继续显示本地缓存用户和明确的重试提示。

  > 本地验证：`teacher-overview.test.js` 与其余历史回归测试已通过；总契约测试会在后续子包、审核中心和索引任务完成前继续保持红灯。

- [ ] **步骤 6：部署并回读验证**

  使用教师账号验证零班级、多个班级、无任务、有待审核提交、有待审核入班申请五种场景。CloudBase 监控中该函数活跃时段平均耗时应不高于 500ms。

  > 2026-09-18 部署进度：`get-teacher-overview` 已创建并回读为 `Active / Available`，配置与学生聚合函数一致；无微信身份的空调用返回业务 `401`。真实教师场景和活跃时段平均耗时尚未验收。

  > 体验反馈与监控：用户扫码测试后反馈未发现明显问题。最近一小时 `FunctionDuration` 平均 80.28ms、最大 335.67ms，`FunctionError` 为 0；仍需用明确的五种教师场景逐项确认。

- [x] **步骤 7：提交**

```bash
git add cloudfunctions/get-teacher-overview miniprogram/services/api.js miniprogram/services/overview.js miniprogram/pages/teacher/index.js tests/teacher-overview.test.js
git commit -m "性能: 合并教师首页统计请求"
```

### 任务 4：合并教师审核中心列表与统计

**优先级：** P0

**文件：**

- 新建：`cloudfunctions/get-teacher-reviews/index.js`
- 新建：`cloudfunctions/get-teacher-reviews/package.json`
- 新建：`tests/teacher-reviews.test.js`
- 修改：`miniprogram/services/api.js`
- 修改：`miniprogram/services/overview.js`
- 修改：`miniprogram/pages/teacher/pending/pending.js`

**接口：**

- 消费：教师班级 ID、`submissions`、`class_join_applications` 和学生基础信息。
- 产出：`OverviewService.getTeacherReviews(params)`，返回第 2.3 节定义的统一列表、统计和班级选项。

- [x] **步骤 1：写失败测试**

```js
const assert = require('assert')
const page = require('fs').readFileSync('miniprogram/pages/teacher/pending/pending.js', 'utf8')

assert.match(page, /OverviewService\.getTeacherReviews/)
assert.doesNotMatch(page, /ClassService\.getClassApplications/)
assert.doesNotMatch(page, /TaskService\.getSubmissions/)
assert.doesNotMatch(page, /buildAppPromise/)
```

- [x] **步骤 2：实现统一审核查询与稳定游标**

  云函数先校验教师身份并获取其班级 ID；提交记录按 `teacher_openid` 查询；入班申请按 `class_id` 分批查询；两类结果在云函数内按 `sort_time DESC、record_type ASC、_id ASC` 稳定排序后合并。接口使用服务端生成的不透明 `cursor`，游标至少包含快照时间、两类数据各自的读取位置和末条排序键；前端只保存并回传 `next_cursor`，不得解析其内容。首次请求在 `include_stats=true` 时同时返回统计与班级选项，后续请求不重复统计。

- [x] **步骤 3：限制列表字段**

  列表只返回卡片展示字段，不返回图片、附件和反馈附件数组。用户打开审核弹层时，继续通过现有提交详情或申请详情接口按 ID 获取完整材料。

- [x] **步骤 4：替换前端加载流程**

  `initPage` 首次只发起一次 `get-teacher-reviews`；筛选条件变化时清空游标并重新请求；滚动到底部携带上次响应的 `next_cursor`。删除 `loadTeacherClasses`、`loadStats` 以及按班级循环发请求的逻辑。

- [x] **步骤 5：减少视图层数据复制**

  原始记录保存在页面实例字段 `this._records`，`data` 中只保留实际渲染的 `displayRecords`。追加分页数据时只把新列表映射为展示模型，避免同时向视图层发送 `records` 和 `displayRecords` 两份完整数组。

- [x] **步骤 6：运行测试**

```powershell
node tests/teacher-reviews.test.js
node tests/miniprogram-performance-contract.test.js
```

  验证默认筛选、仅提交、仅申请、待审核、已处理、指定班级和下一游标七种场景；增加两类记录时间相同、翻页期间新增记录、非法或过期游标三组边界测试，确保无重复、无漏项并返回可识别的参数错误。

  > 本地验证：统一列表、字段裁剪、稳定排序、筛选签名、非法游标和过期游标契约测试已通过；线上数据场景与首屏调用次数留待部署步骤验证。

- [ ] **步骤 7：部署并验证调用次数**

  使用拥有至少 5 个班级的教师账号打开审核中心，首屏网络记录只能出现一次业务云函数调用；滚动加载每页只增加一次调用。

  > 2026-09-18 部署进度：`get-teacher-reviews` 已创建并回读为 `Active / Available`，无微信身份的空调用返回业务 `401`。多班级教师的首屏与翻页调用次数仍需在体验版中验证。

  > 体验反馈与监控：用户扫码测试后未发现明显问题。最近一小时 `FunctionDuration` 平均 105.62ms、最大 368ms，`FunctionError` 为 0；首屏一次调用和连续翻页仍需用网络面板计数确认。

- [x] **步骤 8：提交**

```bash
git add cloudfunctions/get-teacher-reviews miniprogram/services/api.js miniprogram/services/overview.js miniprogram/pages/teacher/pending/pending.js tests/teacher-reviews.test.js
git commit -m "性能: 合并教师审核中心请求"
```

### 任务 5：优化公告查询和首页弹窗加载

**优先级：** P1

**文件：**

- 修改：`cloudfunctions/get-announcements/index.js`
- 修改：`miniprogram/services/announcement.js`
- 修改：`tests/subscribe-message-pages.test.js`
- 新建：`tests/announcement-performance.test.js`

**接口：**

- 保持 `list`、`popup_list`、`total`、`page`、`page_size` 字段兼容。
- `only_popup=true` 时只返回 `popup_list`，`list` 为空数组。

- [x] **步骤 1：写公告性能失败测试**

```js
const assert = require('assert')
const source = require('fs').readFileSync('cloudfunctions/get-announcements/index.js', 'utf8')

assert.match(source, /ANNOUNCEMENT_CACHE_TTL/)
assert.match(source, /\.field\(\{[\s\S]*announcement_id: true/)
assert.match(source, /onlyPopup/)
```

- [x] **步骤 2：裁剪已读记录与公告字段**

  `announcement_reads` 只投影 `announcement_id`；公告只投影客户端实际使用的标题、内容、可见范围、时间、排序和动作字段。

- [x] **步骤 3：增加 60 秒温实例缓存**

```js
const ANNOUNCEMENT_CACHE_TTL = 60 * 1000
let announcementCache = {
  expiresAt: 0,
  list: []
}
```

  缓存只保存已发布公告，不保存用户已读状态；每个请求仍单独读取当前用户的 `announcement_reads`。缓存过期后重新查询，确保公告变更最多延迟 60 秒生效。

- [x] **步骤 4：首页只请求弹窗数据**

  `AnnouncementService.getPopupAnnouncements()` 固定传入 `{ only_popup: true, page: 1, page_size: 20 }`，通知中心继续调用普通列表模式。

- [ ] **步骤 5：运行测试与监控验收**

```powershell
node tests/announcement-performance.test.js
node tests/subscribe-message-pages.test.js
```

  部署后观察至少三个活跃小时，`get-announcements` 每小时平均耗时应不高于 400ms，错误和超时保持为 0。

  > 本地验证：公告性能契约与订阅消息页面回归已通过；三个活跃小时的线上监控验收需在部署后完成。

  > 2026-09-18 部署进度：`get-announcements` 已更新并回读为 `Active / Available`，运行时、超时、内存和共享层未改变。最近一小时 `FunctionDuration` 平均 225.28ms、最大 798ms，`FunctionError` 为 0；平均值已低于 400ms 目标，但观察窗口不足三个活跃小时，本步骤暂不勾选。

- [x] **步骤 6：提交**

```bash
git add cloudfunctions/get-announcements/index.js miniprogram/services/announcement.js tests/announcement-performance.test.js tests/subscribe-message-pages.test.js
git commit -m "性能: 精简公告查询与弹窗加载"
```

### 任务 6：精简列表载荷并配置复合索引

**优先级：** P1

**文件：**

- 修改：`cloudfunctions/get-tasks/index.js`
- 修改：`cloudfunctions/get-submissions/index.js`
- 修改：`cloudfunctions/get-classes/index.js`
- 修改：`cloudfunctions/get-class-applications/index.js`
- 新建：`tests/list-payload-performance.test.js`

**接口：**

- `get-tasks` 新增可选参数 `view=list|detail`，默认 `list`。
- `get-submissions` 新增可选参数 `view=list|task_ids`，默认 `list`。
- 既有调用不传新参数时保持兼容。

- [x] **步骤 1：写字段裁剪失败测试**

```js
const assert = require('assert')
const fs = require('fs')

const tasks = fs.readFileSync('cloudfunctions/get-tasks/index.js', 'utf8')
const submissions = fs.readFileSync('cloudfunctions/get-submissions/index.js', 'utf8')

assert.match(tasks, /TASK_LIST_FIELDS/)
assert.match(submissions, /SUBMISSION_LIST_FIELDS/)
assert.match(submissions, /view === 'task_ids'/)
```

- [x] **步骤 2：为任务列表增加字段白名单**

  列表保留 `_id`、标题、简述、项目、班级、类型、可见性、状态、积分、难度、发布时间、截止时间和更新时间；图片、附件、长正文只由详情接口返回。

- [x] **步骤 3：为提交列表增加字段白名单**

  列表保留 `_id`、任务/班级/学生标识与名称、状态、分数、积分、提交和审核时间；提交正文、图片、附件和反馈附件只在详情模式返回。`task_ids` 模式仅返回 `task_id`。

- [x] **步骤 4：只读核对线上索引**

  使用 CloudBase MCP 的 `readNoSqlDatabaseStructure(action="listIndexes")` 分别读取 `tasks`、`submissions`、`classes`、`class_join_applications`、`class_memberships`、`announcements`、`announcement_reads`。

  > 2026-09-18 回读结果：七个集合均已核对。`announcements` 已有 `status + is_deleted + sort_order + publish_time`，`announcement_reads` 已有 `user_openid + read_time` 与唯一的 `announcement_id + user_openid`，`class_memberships` 已有 `student_openid` 和唯一的 `class_id + student_openid`；下表八个目标复合索引均无同等索引。待创建参数已保存到 `docs/cloudbase-performance-indexes.json`。

- [x] **步骤 5：新增复合索引**

  在没有同等索引时新增：

| 集合 | 索引字段 |
|---|---|
| `tasks` | `teacher_openid ASC, is_deleted ASC, update_time DESC` |
| `tasks` | `status ASC, task_type ASC, visibility ASC, publish_time DESC` |
| `tasks` | `class_id ASC, status ASC, publish_time DESC` |
| `submissions` | `teacher_openid ASC, status ASC, submit_time DESC` |
| `submissions` | `student_openid ASC, submit_time DESC` |
| `submissions` | `student_openid ASC, task_id ASC` |
| `classes` | `teacher_openid ASC, status ASC, update_time DESC` |
| `class_join_applications` | `class_id ASC, status ASC, create_time DESC` |

  索引字段顺序必须与实际 `where + orderBy` 查询一致；创建后回读并记录索引名称、字段和方向。

  > 2026-09-18 线上结果：8 个非唯一复合索引已全部创建并回读确认。`tasks`：`idx_teacher_deleted_update`、`idx_status_type_visibility_publish`、`idx_class_status_publish`；`submissions`：`idx_teacher_status_submit`、`idx_student_submit`、`idx_student_task`；`classes`：`idx_teacher_status_update`；`class_join_applications`：`idx_class_status_create`。字段顺序和升降序均与上表一致。

- [x] **步骤 6：运行测试**

```powershell
node tests/list-payload-performance.test.js
node tests/student-overview.test.js
node tests/teacher-overview.test.js
node tests/teacher-reviews.test.js
```

- [ ] **步骤 7：验证返回体积**

  对任务列表和提交列表各取 20 条，记录优化前后 JSON 字节数；两个列表返回体积均应减少至少 30%，字段完整性测试必须通过。

- [x] **步骤 8：提交**

```bash
git add cloudfunctions/get-tasks/index.js cloudfunctions/get-submissions/index.js cloudfunctions/get-classes/index.js cloudfunctions/get-class-applications/index.js tests/list-payload-performance.test.js
git commit -m "性能: 精简列表载荷并补充查询索引"
```

### 任务 7：拆分小程序非核心页面包

**优先级：** P2

**文件：**

- 修改：`miniprogram/app.json`
- 移动：非 Tab 详情页到 `miniprogram/subpackages/student/`、`miniprogram/subpackages/teacher/`、`miniprogram/subpackages/common/`
- 修改：所有受影响的 `navigateTo`、分享路径和通知跳转路径
- 修改：`tests/miniprogram-performance-contract.test.js`
- 新建：`tests/miniprogram-routes.test.js`

**接口：**

- 主包保留登录页和七个 TabBar 页面。
- 分包页面继续使用原有业务参数名，不改变页面功能。

- [x] **步骤 1：建立路由清单测试**

  测试应读取 `app.json`，验证每个代码中的绝对页面路径都存在于主包或分包清单中；验证 TabBar 页面全部位于主包。

- [x] **步骤 2：拆分学生扩展包**

  移动任务详情、提交编辑、提交记录、班级详情、入班确认、积分明细、抽奖和抽奖记录页面。学生首页、排行榜、我的、班级管理和任务管理 Tab 页面继续留在主包。

- [x] **步骤 3：拆分教师扩展包**

  移动班级详情、班级编辑、任务详情和任务编辑页面。教师首页、审核中心、任务管理和我的 Tab 页面继续留在主包。

- [x] **步骤 4：拆分公共扩展包**

  将通知中心放入公共分包；公告动作、系统通知和分享路径统一改为新的分包路径。

- [x] **步骤 5：执行全仓路由扫描**

```powershell
rg -n "pages/(student|teacher|common)/" miniprogram cloudfunctions
node tests/miniprogram-routes.test.js
node tests/subscribe-message-pages.test.js
```

  每一个旧路径都必须确认是 TabBar 保留路径、兼容入口或已替换路径，不允许保留失效跳转。

  > 本地验证：路由清单、性能总契约和订阅消息页面测试均已通过；运行时代码中已无被移动页面的旧绝对路径。

- [ ] **步骤 6：在微信开发者工具重新构建 npm 并检查包体**

  清理旧构建缓存后执行“构建 npm”，查看代码依赖分析。主包目标不高于 1.5MiB，每个分包不高于平台限制，所有分包均能正常预加载和跳转。

  > 2026-09-18 本地尝试：已定位微信开发者工具 `2.01.2602032`，CLI 构建因账号需要重新登录（错误码 10）中止。当前第一方源码静态统计：主包约 381,207 bytes、学生分包 140,301 bytes、教师分包 121,536 bytes、公共分包 7,886 bytes；最终上传包体仍须登录开发者工具后确认。

- [x] **步骤 7：提交**

```bash
git add miniprogram/app.json miniprogram/pages miniprogram/subpackages miniprogram/services cloudfunctions tests/miniprogram-performance-contract.test.js tests/miniprogram-routes.test.js tests/subscribe-message-pages.test.js
git commit -m "性能: 拆分小程序非核心页面包"
```

### 任务 8：控制长列表渲染和排行榜返回量

**优先级：** P2

**文件：**

- 修改：`cloudfunctions/get-ranking/index.js`
- 修改：`miniprogram/services/ranking.js`
- 修改：`miniprogram/pages/student/rank/rank.js`
- 修改：`miniprogram/pages/student/rank/rank.wxml`
- 修改：`miniprogram/pages/teacher/pending/pending.js`
- 新建：`tests/long-list-performance.test.js`

**接口：**

- `get-ranking` 支持 `page`、`page_size` 和 `current_user_only`。
- `current_user_only=true` 时返回当前用户排名与参与人数，`list` 为空数组。
- 排行榜页面默认每页 30 条，滚动到底加载下一页。

- [x] **步骤 1：写排行榜分页失败测试**

```js
const assert = require('assert')
const source = require('fs').readFileSync('cloudfunctions/get-ranking/index.js', 'utf8')

assert.match(source, /current_user_only/)
assert.match(source, /page_size/)
assert.match(source, /has_more/)
```

- [x] **步骤 2：为快照结果增加服务端切片**

  从快照中计算当前用户卡片后，只返回请求页的列表；首页只请求 `current_user_only=true`，排行榜页使用分页列表。

- [x] **步骤 3：改造排行榜页面增量渲染**

  首次加载 30 条，滚动到底追加下一页；切换周榜、月榜、总榜时清空页码和列表。只更新新增列表和分页状态，不重复向视图层发送完整原始快照。

- [x] **步骤 4：限制审核列表视图节点数**

  审核中心仅保留当前已加载页的展示模型；切换筛选时清空旧列表。连续加载超过 200 条时提示用户使用筛选条件，不继续无限追加。

- [ ] **步骤 5：运行测试与滚动检查**

```powershell
node tests/long-list-performance.test.js
node tests/teacher-reviews.test.js
```

  真机滚动排行榜和审核列表，检查无重复项、无跳项、无明显白屏，页面节点数不超过设计上限。

  > 本地验证：排行榜分页追加、当前用户摘要和审核列表 200 条上限契约测试已通过；真机连续滚动检查仍需在开发者工具可用后完成。

- [x] **步骤 6：提交**

```bash
git add cloudfunctions/get-ranking/index.js miniprogram/services/ranking.js miniprogram/pages/student/rank miniprogram/pages/teacher/pending/pending.js tests/long-list-performance.test.js
git commit -m "性能: 优化排行榜与审核长列表渲染"
```

### 任务 9：全量验证、灰度发布与监控复盘

**优先级：** P0

**文件：**

- 修改：`docs/MINIPROGRAM_PERFORMANCE_OPTIMIZATION_TASK_PLAN.md`
- 按测试结果更新：`docs/DEVELOPMENT_TASKS.md`

**接口：** 无新增业务接口；本任务验证前八项交付物。

- [x] **步骤 1：运行全部仓库测试**

```powershell
$testFiles = Get-ChildItem tests -Filter '*.test.js' | Sort-Object Name
foreach ($testFile in $testFiles) {
  & node $testFile.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

  预期：所有测试退出码均为 0。

  > 2026-09-18 本地结果：按文件名顺序运行 `tests/*.test.js`，18/18 通过；三个新增聚合云函数语法检查 3/3 通过，`git diff --check` 通过。

- [ ] **步骤 2：执行核心业务回归**

  学生端验证登录、首页、加入班级、任务列表、任务详情、提交、提交记录、排行榜、公告；教师端验证首页、班级、任务、审核、申请处理和公告。

  > 2026-09-18 用户反馈：扫码体验未发现明显问题，加载速度较之前明显提升。该反馈记为体验通过的定性证据；由于未逐项记录上述清单结果，本步骤暂不勾选。

- [ ] **步骤 3：执行性能验收**

  按第 1.3 节统一条件分别测试学生首页、教师首页和审核中心 20 次，计算 P75；记录主包/分包体积、云函数调用数、接口平均耗时和返回体积。

  > 静态验收：已登录后的学生首页和教师首页代码路径均为“1 次聚合接口 + 1 次公告弹窗接口”，教师审核中心首屏为 1 次聚合接口；达到调用次数设计目标。P75、云函数平均耗时、线上返回体积和开发者工具包体需在部署后实测，不能用静态检查替代。

  > 2026-09-18 开发者工具实测包体：总计 985,770 bytes（962.7KB），主包 769,878 bytes（751.8KB），公共分包 6,981 bytes，学生分包 113,664 bytes，教师分包 95,247 bytes；主包低于 1.5MiB 目标。P75、调用次数和真实接口耗时仍待扫码后按角色测量。

- [ ] **步骤 4：灰度上传体验版**

  先上传体验版并由学生、教师两种角色各完成一次完整流程。体验版无功能回归后再提交正式审核，不在同一批次混入其他业务功能。

  > 2026-09-18 进度：开发者工具预览编译和代码上传成功，已生成扫码二维码；学生、教师完整流程尚未验收，因此本步骤暂不勾选，也未提交正式审核或发布。

  > 用户扫码后反馈未发现明显问题、加载速度明显提升。随后已部署 `get-tasks`、`get-submissions`、`get-ranking`、`get-announcements`、`get-classes`、`get-class-applications` 六个向后兼容的性能接口，并逐一回读为可用；通知发送、抽奖、共享层及正式小程序版本均未发布。

- [ ] **步骤 5：观察线上 24 小时监控**

  查询 `FunctionInvocation`、`FunctionDuration`、`FunctionError`、`FunctionTimeout`、`FunctionThrottle`；确认错误、超时、限流均为 0，并将核心函数耗时写入验收记录。

- [x] **步骤 6：更新项目任务文档**

  在 `docs/DEVELOPMENT_TASKS.md` 的性能优化阶段记录完成项和最终指标；未达到目标的指标必须写明实测值、原因和下一轮动作。

- [x] **步骤 7：提交**

```bash
git add docs/MINIPROGRAM_PERFORMANCE_OPTIMIZATION_TASK_PLAN.md docs/DEVELOPMENT_TASKS.md
git commit -m "文档: 记录小程序性能优化验收结果"
```

---

## 5. 风险与回滚方案

| 风险 | 预防措施 | 回滚方式 |
|---|---|---|
| 聚合接口统计口径与旧页面不一致 | 新旧接口并行比对同一账号结果 | 页面服务层切回旧接口，保留新云函数不调用 |
| 复合索引创建时间较长 | 先创建索引并等待状态可用，再部署代码 | 保留旧索引，不删除现有索引 |
| 分包后通知或分享路径失效 | 全仓路径扫描和真机打开通知链接 | 回滚 `app.json` 与页面移动提交 |
| 首页缓存展示旧角色 | 聚合接口返回后强制校正角色和本地缓存 | 恢复启动阶段用户信息刷新 |
| 公告缓存导致短暂延迟 | 缓存固定为 60 秒且不缓存已读状态 | 将缓存 TTL 改为 0 即可关闭 |
| 审核中心合并分页出现重复或漏项 | 使用包含快照时间和两类读取位置的不透明游标，并按 `sort_time + record_type + _id` 稳定排序 | 切回原列表接口，保留聚合统计接口 |

每个任务独立提交，线上出现回归时只回滚对应任务提交，不使用破坏性重置。

---

## 6. 验收记录

实施时在下表追加实测结果，不用主观描述替代数据。

2026-09-17 自动化基线：8 个历史测试全部通过；新增性能契约测试按预期在“尚未配置分包”处失败。当前环境未检测到微信开发者工具或 `miniprogram-ci`，真机 P75、首屏 `setData` 次数和开发者工具包体基线仍需在最终验收前补测。

2026-09-18 灰度部署进度：已新增三个聚合云函数并确认状态可用，未覆盖现有线上函数；8 个复合索引已创建并回读。三个新函数的无身份空调用均由业务层返回 `401`，平台调用成功且耗时分别为 4ms、5ms、6ms。该结果仅证明函数可加载及身份保护生效，不代表真实角色数据或页面性能已通过验收。

2026-09-18 体验与第二阶段部署：用户扫码反馈未发现明显问题，加载速度较之前明显提升。六个现有性能接口已部署并回读，配置保持不变。部署后最近 10 分钟环境级 `FunctionError`、`FunctionTimeout`、`FunctionThrottle` 均为 0，环境 `FunctionDuration` 平均 391.94ms；该窗口包含环境内其他函数，不能作为三个聚合接口的 P75。最近一小时分函数平均耗时分别为：学生聚合 49.39ms、教师聚合 80.28ms、审核聚合 105.62ms、公告 225.28ms，四者错误均为 0。

| 指标 | 优化前 | 优化后 | 目标 | 结果 |
|---|---:|---:|---:|---|
| 学生首页首轮调用数 | 7～10 | 未实施 | ≤2 | 未验收 |
| 教师首页首轮调用数 | ≥`6 + 班级数` | 未实施 | ≤2 | 未验收 |
| 审核中心首屏调用数 | 约`6 + 5 × 班级数` | 未实施 | 1 | 未验收 |
| 公告平均耗时 | 671～794ms | 225.28ms（最近一小时 5 分钟聚合） | ≤400ms | 短窗口通过，待三个活跃小时 |
| 学生聚合接口平均耗时 | 无 | 49.39ms（最近一小时 5 分钟聚合） | ≤500ms | 短窗口通过，待 24 小时 |
| 教师聚合接口平均耗时 | 无 | 80.28ms（最近一小时 5 分钟聚合） | ≤500ms | 短窗口通过，待 24 小时 |
| 审核聚合接口平均耗时 | 无 | 105.62ms（最近一小时 5 分钟聚合） | ≤600ms | 短窗口通过，待 24 小时 |
| 主包体积 | 待开发者工具确认 | 769,878 bytes | ≤1.5MiB | 通过 |
| 学生首页 P75 | 待真机测量 | 未实施 | ≤1.5s | 未验收 |
| 教师首页 P75 | 待真机测量 | 未实施 | ≤1.8s | 未验收 |
| 审核中心 P75 | 待真机测量 | 未实施 | ≤1.5s | 未验收 |
| 云函数错误/超时/限流 | 0/0/0 | 最近 10 分钟 0/0/0 | 0/0/0 | 短窗口通过，待 24 小时 |

---

## 7. 完成定义

只有同时满足以下条件，才能将本计划标记为完成：

- [ ] 九个任务全部完成并有独立提交。
- [ ] 全量自动化测试全部通过。
- [ ] 学生、教师两种角色核心流程真机回归通过。
- [ ] 首页和审核中心调用次数达到目标。
- [ ] 核心云函数耗时达到目标，且连续 24 小时无错误、超时、限流。
- [ ] 主包体积达到目标，所有分包页面和通知路径可正常打开。
- [ ] 本文验收记录与 `docs/DEVELOPMENT_TASKS.md` 已更新。
