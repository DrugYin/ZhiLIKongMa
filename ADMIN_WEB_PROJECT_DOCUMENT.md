# 智慧控码后台管理网站项目文档

**文档版本**: v1.0.0  
**最后更新**: 2026-04-17  
**适用范围**: 独立后台管理网站（Web Admin）  
**关联项目**: 智慧控码训练系统微信小程序  
**数据来源**: 腾讯云开发 / CloudBase 文档数据库、云函数、云存储

---

## 1. 项目背景

智慧控码训练系统微信小程序已经上线并运营一周，当前核心链路包括用户注册、班级管理、任务发布、学生提交、教师审核、积分发放和排行榜，整体运行稳定，没有出现明显大问题。

随着真实运营持续推进，单靠小程序端页面已经难以高效支撑以下工作：

- 查看整体运营数据和关键指标。
- 统一调整注册积分、任务提交次数、抽奖开关等系统配置。
- 管理训练项目、任务分类、难度等级等运营参数。
- 追踪教师审核、学生提交、配置修改等关键操作日志。
- 为后续积分明细、抽奖、用户运营和数据分析提供管理入口。

因此，需要建设一个独立的后台管理网站。后台管理网站不替代小程序业务端，而是作为运营与管理控制台，继续复用现有云开发数据和云函数能力。

---

## 2. 项目目标

### 2.1 总体目标

建设一个基于 Web 的后台管理网站，用于运营统计、系统配置、项目配置和运维管理，数据仍存储在当前 CloudBase 云开发环境中。

### 2.2 MVP 目标

第一阶段先完成可投入使用的最小后台：

1. 管理员登录与权限校验。
2. 运营统计总览。
3. 系统配置查看与编辑。
4. 项目配置查看与编辑。
5. 操作日志查询。
6. 基础部署到 CloudBase 静态网站托管。

### 2.3 非目标

第一阶段暂不做以下内容：

- 不做复杂 BI 报表编辑器。
- 不做完整 CRM 或用户画像系统。
- 不做抽奖全量上线管理闭环。
- 不做替代教师端任务审核的全功能后台。
- 不直接让前端绕过云函数修改敏感数据库。

---

## 3. 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vue 3 | 适合后台管理系统，开发效率高 |
| 构建工具 | Vite | 启动快、构建简单 |
| UI 组件 | TDesign Vue Next | 与小程序端 TDesign Mini 保持体系一致 |
| 图表 | ECharts | 用于运营趋势、提交量、审核率等图表 |
| 状态管理 | Pinia | 管理登录态、用户信息、全局配置 |
| 路由 | Vue Router Hash 模式 | 更适合静态网站托管，避免刷新 404 |
| 云 SDK | @cloudbase/js-sdk | Web 端初始化、认证、调用云函数 |
| 后端 | CloudBase 云函数 | 承接管理端权限校验和敏感操作 |
| 数据库 | CloudBase 文档数据库 | 复用当前小程序数据集合 |
| 部署 | CloudBase 静态网站托管 | 静态构建产物部署，支持 CDN 和 HTTPS |

### 3.1 推荐架构

```text
后台管理网站 admin-web
  |
  | CloudBase Web SDK
  v
CloudBase Web Auth / 登录态
  |
  | callFunction
  v
管理端云函数 admin-*
  |
  | 权限校验、参数校验、审计日志
  v
CloudBase 文档数据库 / 云存储
```

### 3.2 核心原则

- 后台前端不直接修改敏感集合。
- 所有写操作必须走管理端云函数。
- 管理端云函数必须校验管理员权限。
- 配置变更必须写入 `operation_logs`。
- 查询接口默认分页，避免一次读取过多数据。
- 后台项目和小程序项目可放在同一仓库，但目录隔离。

---

## 4. 目录规划

### 4.1 前端目录

建议在当前仓库新增 `admin-web/`：

```text
admin-web/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── api/
│   │   ├── cloudbase.js
│   │   ├── admin.js
│   │   ├── config.js
│   │   ├── dashboard.js
│   │   └── projects.js
│   ├── router/
│   │   └── index.js
│   ├── stores/
│   │   ├── auth.js
│   │   └── app.js
│   ├── layouts/
│   │   └── AdminLayout.vue
│   ├── pages/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── config/
│   │   ├── projects/
│   │   ├── users/
│   │   ├── tasks/
│   │   └── logs/
│   ├── components/
│   ├── utils/
│   └── styles/
└── dist/
```

### 4.2 云函数目录

继续放在当前 `cloudfunctions/` 下：

```text
cloudfunctions/
├── admin-auth-check/
├── admin-get-statistics/
├── admin-get-config/
├── admin-update-config/
├── admin-get-projects/
├── admin-update-project/
├── admin-get-users/
├── admin-get-tasks/
├── admin-get-operation-logs/
└── admin-refresh-ranking/
```

---

## 5. 用户与权限设计

### 5.1 角色定义

| 角色 | 权限范围 |
|------|----------|
| 超级管理员 | 所有统计、配置、项目、用户、日志管理 |
| 运营管理员 | 查看统计、查看用户、调整运营配置、查看日志 |
| 教务管理员 | 查看班级、任务、提交、审核相关数据 |
| 只读观察员 | 仅查看统计和部分列表，不允许修改 |

第一阶段可以先只实现 `admin` 和 `viewer` 两类。

### 5.2 管理员身份来源

建议在 `users` 集合中扩展字段：

```js
{
  _openid: "小程序 openid",
  phone: "13800000000",
  roles: ["student", "teacher", "admin"],
  admin_role: "super_admin",
  admin_status: "active",
  admin_auth_uid: "后台 Web Auth UID，首次后台登录后自动写入",
  admin_permissions: ["dashboard:read", "config:read"]
}
```

### 5.3 推荐方案

第一阶段推荐使用 `users.roles` 扩展 `admin` 角色，并使用 `users.admin_auth_uid` 绑定后台 Web 登录身份。原因是当前系统已经使用统一 `users` 表，改动小、可复用现有用户数据，同时不需要维护独立管理员集合。

### 5.4 权限校验流程

```text
Web 登录
  |
获取 CloudBase 登录态
  |
调用 admin-auth-check
  |
云函数根据 Web Auth uid 查询 users.admin_auth_uid
  |
未绑定时根据 Web Auth 手机号匹配 users.phone 并自动绑定
  |
校验 roles 是否包含 admin
  |
返回管理员资料和权限
```

### 5.5 安全要求

- 所有 `admin-*` 云函数必须校验管理员权限。
- 所有写操作必须记录操作者、操作内容、变更前后值。
- 禁止前端直接暴露数据库写权限。
- 禁止在前端硬编码管理员名单。
- 禁止在仓库中提交 SecretId、SecretKey 等密钥。

---

## 6. 功能模块设计

## 6.1 登录模块

### 功能范围

- 管理员登录。
- 登录态检测。
- 未登录自动跳转登录页。
- 无管理员权限时提示无权访问。
- 退出登录。

### 验收标准

- 当用户未登录时，系统应跳转登录页。
- 当用户已登录但不是管理员时，系统应拒绝访问后台。
- 当管理员登录成功时，系统应进入运营概览页。

---

## 6.2 运营统计模块

### 页面名称

运营概览 / Dashboard

### 核心指标

| 指标 | 说明 |
|------|------|
| 注册用户数 | `users` 总注册人数 |
| 学生数 | `roles` 包含 `student` 的用户数 |
| 教师数 | `roles` 包含 `teacher` 的用户数 |
| 班级数 | `classes.status = active` |
| 任务数 | `tasks.is_deleted != true` |
| 已发布任务数 | `tasks.status = published` |
| 提交总数 | `submissions` 总数 |
| 待审核数 | `submissions.status = pending` |
| 通过数 | `submissions.status = approved` |
| 驳回数 | `submissions.status = rejected` |
| 审核通过率 | 通过数 / 已审核数 |
| 本周提交数 | 本周 `submit_time` 统计 |
| 本周积分发放 | 本周审核通过 `points_earned` 汇总 |
| 排行榜活跃人数 | 周榜 / 月榜上榜人数 |

### 图表

- 最近 7 天注册趋势。
- 最近 7 天任务提交趋势。
- 最近 7 天审核处理趋势。
- 项目维度任务数量。
- 班级维度提交数量。
- 积分发放趋势。

### 云函数

`admin-get-statistics`

### 入参

```js
{
  range_type: "7d",      // 7d | 30d | custom
  start_date: "2026-04-01",
  end_date: "2026-04-17"
}
```

### 出参

```js
{
  success: true,
  data: {
    overview: {
      user_count: 120,
      student_count: 108,
      teacher_count: 12,
      class_count: 8,
      task_count: 45,
      published_task_count: 40,
      submission_count: 320,
      pending_submission_count: 12,
      approved_submission_count: 280,
      rejected_submission_count: 28,
      approval_rate: 90.9,
      weekly_points: 560
    },
    trends: {
      registrations: [],
      submissions: [],
      reviews: [],
      points: []
    },
    rankings: {
      week_participant_count: 30,
      month_participant_count: 58
    }
  }
}
```

### 验收标准

- 当管理员打开运营概览页时，系统应展示核心指标卡片。
- 当管理员切换时间范围时，系统应刷新趋势图。
- 当某个集合数据为空时，系统应显示 0 或空状态，而不是报错。

---

## 6.3 系统配置模块

### 页面名称

系统配置 / System Config

### 当前已使用配置

| 配置键 | 类型 | 默认值 | 当前是否生效 | 说明 |
|--------|------|--------|--------------|------|
| `points_register_gift` | number | 50 | 是 | 注册赠送积分 |
| `task_max_submissions` | number | 3 | 是 | 任务默认最大提交次数 |

### 后续可能使用配置

| 配置键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `points_per_task` | number | 10 | 任务默认积分 |
| `points_daily_limit` | number | 100 | 每日积分上限 |
| `lottery_enabled` | boolean | false | 抽奖功能开关 |
| `lottery_cost_points` | number | 10 | 每次抽奖消耗积分 |
| `lottery_daily_limit` | number | 5 | 每日抽奖次数上限 |
| `class_max_members` | number | 50 | 班级默认人数上限 |
| `class_join_need_approval` | boolean | true | 入班是否需要审批 |
| `task_overtime_penalty` | number | 0.5 | 超时提交积分系数 |

### 云函数

- `admin-get-config`
- `admin-update-config`

### 配置数据结构

```js
{
  config_key: "task_max_submissions",
  config_value: 3,
  value_type: "number",
  description: "任务默认最大提交次数",
  category: "task",
  is_public: true,
  update_by: "admin_openid",
  create_time: Date,
  update_time: Date
}
```

### 更新入参

```js
{
  config_key: "task_max_submissions",
  config_value: 3
}
```

### 校验规则

- number 类型必须是有效数字。
- boolean 类型必须是布尔值。
- `task_max_submissions` 必须大于 0。
- `points_register_gift` 不能小于 0。
- `lottery_cost_points` 不能小于 0。
- 禁止更新不存在的配置键，除非管理员使用新增配置功能。

### 验收标准

- 当管理员打开系统配置页时，系统应按分类展示配置项。
- 当管理员修改配置时，系统应校验类型和取值范围。
- 当配置修改成功时，系统应写入 `operation_logs`。
- 当配置修改失败时，系统应显示明确错误信息。

---

## 6.4 项目配置模块

### 页面名称

训练项目 / Projects

### 功能范围

- 查看项目列表。
- 编辑项目名称、描述、状态、排序。
- 编辑难度等级。
- 编辑任务分类。
- 查看项目关联任务数和学生数。

### 云函数

- `admin-get-projects`
- `admin-update-project`

### 数据结构

```js
{
  project_name: "编程",
  project_code: "programming",
  description: "编程基础与进阶训练",
  difficulty_levels: [
    { level: 1, name: "入门", color: "#52c41a" },
    { level: 2, name: "基础", color: "#1890ff" }
  ],
  task_categories: ["基础语法", "算法练习", "项目实战"],
  default_points: 10,
  bonus_multiplier: 1,
  sort_order: 1,
  status: "active",
  is_default: true,
  task_count: 0,
  student_count: 0
}
```

### 验收标准

- 当管理员进入项目配置页时，系统应展示项目列表。
- 当管理员禁用项目时，前端项目下拉不应再显示该项目。
- 当管理员修改任务分类时，后续发布任务应能读取最新分类。
- 项目编码 `project_code` 不允许随意修改。

---

## 6.5 用户管理模块

### 页面名称

用户管理 / Users

### 第一阶段范围

- 查看用户列表。
- 按角色、状态、手机号、姓名筛选。
- 查看用户详情。
- 查看学生积分。
- 查看教师项目。
- 设置或取消管理员角色。

### 后续范围

- 禁用用户。
- 重置用户角色。
- 导出用户数据。
- 查看用户参与班级、任务提交、积分明细。

### 云函数

- `admin-get-users`
- `admin-update-user-role`

### 验收标准

- 当管理员查询用户时，系统应分页返回结果。
- 当管理员设置用户为后台管理员时，系统应写入操作日志。
- 当管理员尝试修改自己的超级管理员权限时，系统应二次确认。

---

## 6.6 任务与提交查看模块

### 页面名称

任务与提交 / Tasks & Submissions

### 第一阶段范围

- 查看任务列表。
- 查看任务详情。
- 查看任务提交列表。
- 查看提交审核状态。
- 按项目、班级、教师、状态筛选。

### 不在第一阶段做的事

- 不代替教师审核。
- 不批量修改学生提交状态。
- 不直接删除提交记录。

### 云函数

- `admin-get-tasks`
- `admin-get-submissions`

### 验收标准

- 管理员可以定位某个任务的提交情况。
- 管理员可以查询待审核积压情况。
- 系统不允许后台绕过教师审核流程直接改状态。

---

## 6.7 操作日志模块

### 页面名称

操作日志 / Operation Logs

### 功能范围

- 查看操作日志。
- 按操作者、操作类型、目标类型、时间范围筛选。
- 查看配置变更前后值。
- 查看任务、审核、班级相关操作。

### 云函数

`admin-get-operation-logs`

### 日志结构

```js
{
  user_openid: "openid",
  user_type: "admin",
  action: "update_config",
  target_type: "system_config",
  target_id: "task_max_submissions",
  detail: {
    before: 3,
    after: 5
  },
  create_time: Date
}
```

### 验收标准

- 配置变更必须能在日志中追踪。
- 项目配置变更必须能在日志中追踪。
- 管理员可以按时间倒序查看最近操作。

---

## 7. 数据库设计补充

### 7.1 继续复用的集合

- `users`
- `classes`
- `class_memberships`
- `class_join_applications`
- `tasks`
- `submissions`
- `submission_counters`
- `projects`
- `system_config`
- `operation_logs`
- `ranking_snapshots`

### 7.2 建议新增字段

`users`

```js
{
  roles: ["student", "teacher", "admin"],
  admin_role: "super_admin",
  admin_status: "active"
}
```

`operation_logs`

```js
{
  request_source: "admin-web",
  ip_address: "",
  user_agent: ""
}
```

### 7.3 推荐索引

| 集合 | 索引 |
|------|------|
| `users` | `_openid` 唯一、`roles`、`status`、`phone` |
| `projects` | `project_code` 唯一、`status`、`sort_order` |
| `classes` | `class_code` 唯一、`teacher_openid`、`status` |
| `tasks` | `teacher_openid`、`class_id`、`project_code`、`status`、`publish_time` |
| `submissions` | `task_id`、`student_openid`、`teacher_openid`、`status`、`submit_time` |
| `system_config` | `config_key` 唯一、`category`、`is_public` |
| `operation_logs` | `user_openid`、`action`、`target_type`、`create_time` |
| `ranking_snapshots` | `_id` |

---

## 8. 云函数接口清单

### 8.1 管理员权限

| 云函数 | 说明 | 优先级 |
|--------|------|--------|
| `admin-auth-check` | 校验当前用户是否管理员 | P0 |

### 8.2 运营统计

| 云函数 | 说明 | 优先级 |
|--------|------|--------|
| `admin-get-statistics` | 获取运营总览与趋势数据 | P0 |

### 8.3 系统配置

| 云函数 | 说明 | 优先级 |
|--------|------|--------|
| `admin-get-config` | 获取系统配置列表 | P0 |
| `admin-update-config` | 更新系统配置 | P0 |

### 8.4 项目配置

| 云函数 | 说明 | 优先级 |
|--------|------|--------|
| `admin-get-projects` | 获取项目列表 | P0 |
| `admin-update-project` | 更新项目配置 | P1 |

### 8.5 数据查询

| 云函数 | 说明 | 优先级 |
|--------|------|--------|
| `admin-get-users` | 查询用户列表 | P1 |
| `admin-get-tasks` | 查询任务列表 | P1 |
| `admin-get-submissions` | 查询提交记录 | P1 |
| `admin-get-operation-logs` | 查询操作日志 | P0 |

### 8.6 运维动作

| 云函数 | 说明 | 优先级 |
|--------|------|--------|
| `admin-refresh-ranking` | 触发排行榜快照刷新 | P1 |

---

## 9. 页面规划

### 9.1 路由结构

```text
/login
/dashboard
/config
/projects
/users
/tasks
/submissions
/logs
```

### 9.2 菜单结构

```text
后台管理
├── 运营概览
├── 系统配置
├── 项目配置
├── 用户管理
├── 任务管理
├── 提交记录
└── 操作日志
```

### 9.3 布局

- 顶部：系统名称、环境标识、当前管理员、退出登录。
- 左侧：一级菜单。
- 主区：页面内容。
- 移动端：第一阶段不重点适配，可保证基础可用。

---

## 10. 交互与 UI 方向

后台界面应保持简洁、清晰、可靠，优先满足高频运营操作：

- 首页使用数据卡片和趋势图。
- 配置页使用分组表单。
- 列表页统一使用筛选区 + 表格 + 分页。
- 高风险操作使用二次确认。
- 保存成功后使用明显反馈。
- 错误提示应给出可理解原因。

设计关键词：

- 稳定
- 清晰
- 轻量
- 数据可信
- 操作可追踪

---

## 11. 部署方案

### 11.1 本地开发

```bash
cd admin-web
npm install
npm run dev
```

### 11.2 构建

```bash
npm run build
```

输出目录：

```text
admin-web/dist/
```

### 11.3 部署

部署到 CloudBase 静态网站托管，建议路径：

```text
/admin/
```

### 11.4 路由

使用 Hash 路由：

```text
https://example.com/admin/#/dashboard
```

这样可以减少静态托管刷新 404 的问题。

---

## 12. 安全策略

### 12.1 前端安全

- 不在前端保存敏感密钥。
- 不在前端硬编码管理员名单。
- 不直接暴露数据库写能力。
- 登录态过期后自动跳转登录页。

### 12.2 云函数安全

- 所有 `admin-*` 云函数必须调用统一管理员校验方法。
- 写操作必须校验参数白名单。
- 写操作必须记录 `operation_logs`。
- 配置更新必须限制可更新字段。
- 用户角色变更必须二次确认。

### 12.3 数据安全

- 系统配置保留修改日志。
- 重要字段避免在列表中直接展示完整手机号。
- 后台导出功能后续再做，第一阶段不开放批量导出。

---

## 13. 测试计划

### 13.1 功能测试

- 管理员登录。
- 非管理员访问拦截。
- 运营统计数据加载。
- 系统配置读取。
- 系统配置更新。
- 项目列表读取。
- 操作日志写入。

### 13.2 权限测试

- 非管理员调用 `admin-*` 云函数应失败。
- 管理员只读角色不允许更新配置。
- 已禁用管理员不允许登录后台。

### 13.3 数据测试

- 空数据状态正常。
- 大数据分页正常。
- 配置类型转换正确。
- 趋势数据日期边界正确。

### 13.4 回归测试

- 后台更新配置后，小程序端注册积分和任务提交次数行为符合预期。
- 后台更新项目状态后，小程序端项目下拉符合预期。

---

## 14. 里程碑计划

### 阶段一：后台基础框架

目标：搭建 Web 项目骨架和登录校验。

任务：

- 创建 `admin-web` Vite 项目。
- 接入 TDesign Vue Next。
- 接入 CloudBase Web SDK。
- 实现登录页和布局。
- 实现 `admin-auth-check`。

交付物：

- 可登录的后台空框架。

### 阶段二：运营统计

目标：上线运营概览。

任务：

- 实现 `admin-get-statistics`。
- 实现核心指标卡片。
- 实现趋势图。
- 实现时间范围筛选。

交付物：

- 可查看运营数据的 Dashboard。

### 阶段三：系统配置

目标：后台可管理系统配置。

任务：

- 实现 `admin-get-config`。
- 实现 `admin-update-config`。
- 实现配置分组表单。
- 写入操作日志。

交付物：

- 可调整注册积分、任务提交次数等配置。

### 阶段四：项目配置与日志

目标：支持项目配置和审计追踪。

任务：

- 实现项目列表与编辑。
- 实现操作日志查询。
- 完善权限和二次确认。

交付物：

- 可维护训练项目配置。
- 可追踪后台操作。

### 阶段五：部署与验收

目标：后台正式部署可访问。

任务：

- 构建生产包。
- 部署到 CloudBase 静态网站托管。
- 配置访问路径。
- 完成上线验收。

交付物：

- 后台管理网站访问地址。
- 运维说明。

---

## 15. MVP 验收清单

- [ ] 管理员可以登录后台。
- [ ] 非管理员不能访问后台。
- [ ] 运营概览可展示核心指标。
- [ ] 运营概览可展示最近 7 天趋势。
- [ ] 系统配置可读取。
- [ ] 系统配置可更新。
- [ ] 配置更新会写操作日志。
- [ ] 项目列表可读取。
- [ ] 项目状态可更新。
- [ ] 操作日志可查询。
- [ ] 后台可部署到 CloudBase 静态网站托管。
- [ ] 小程序现有业务不受后台影响。

---

## 16. 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 后台权限校验不足 | 敏感数据被修改 | 所有写操作统一走云函数，并校验管理员 |
| 配置错误影响线上业务 | 小程序行为异常 | 配置表单做类型校验、范围校验、二次确认 |
| 统计查询过慢 | 后台加载慢 | 聚合分页、限制时间范围、必要时增加快照集合 |
| 静态托管刷新 404 | 页面不可访问 | 使用 Hash 路由 |
| 管理员误操作 | 数据异常 | 操作日志、二次确认、后续支持回滚 |

---

## 17. 后续扩展方向

后台 MVP 稳定后，可以继续扩展：

- 积分明细管理。
- 抽奖奖品管理。
- 抽奖记录和兑奖流程。
- 用户成长数据。
- 班级排行榜。
- 教师工作量统计。
- 数据导出。
- 系统公告配置。
- 多环境管理。

---

## 18. 推荐下一步

建议下一步先进入阶段一：

1. 创建 `admin-web` 项目骨架。
2. 接入 CloudBase Web SDK。
3. 新增 `admin-auth-check` 云函数。
4. 跑通管理员登录和权限校验。

只要登录和权限边界先稳定下来，后续运营统计和系统配置就能安全地逐步接入。
