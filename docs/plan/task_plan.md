# 代码审查修复计划

## 背景

对最近20次提交进行代码复用、代码质量、效率三方面审查，共发现41个问题。已修复7个（安全1个、性能5个、代码冲突1个），剩余24个问题按阶段分批修复。

---

## 阶段一：云函数共享模块提取（最高优先级）

消除云函数中最大面积的重复代码，涉及13-21个文件。

### 1.1 新建 `_shared/admin-auth.js`

- **目标**: 提取 `verifyAdmin`、`hasRole`、`getCallerUid` 及 tcb 初始化
- **涉及文件**: 所有 `admin-*` 云函数（13个）
- **操作**:
  - 新建 `cloudfunctions/_shared/admin-auth.js`
  - 导出 `verifyAdmin(db)`、`hasRole(user, role)`、`getCallerUid()`
  - 各云函数删除本地定义，改为 `require('/opt/admin-auth')`
- **验证**: 任意 admin 接口调用正常

### 1.2 新建 `_shared/response.js` 补充（已有基础）

- **目标**: 确认所有云函数使用 `_shared/response.js` 的 `success`/`failure`
- **涉及文件**: 15个重复定义的云函数
- **操作**: 逐个删除本地 `success`/`failure` 定义，改为 `require('/opt/response')`
- **验证**: 所有云函数返回格式一致

### 1.3 新建 `_shared/utils.js`

- **目标**: 提取 `normalizeString`、`tryParseInt`、`tryParseFloat`
- **涉及文件**: 21个云函数（normalizeString）、1个（tryParseInt/Float）
- **操作**:
  - 新建 `cloudfunctions/_shared/utils.js`
  - 导出 `normalizeString`、`tryParseInt`、`tryParseFloat`
  - 各云函数删除本地定义，改为 `require('/opt/utils')`
- **验证**: 任意接口输入处理正常

### 1.4 新建 `_shared/config.js`

- **目标**: 统一 `getConfigValue` 函数
- **涉及文件**: 6个云函数（start-draw、create-class、create-task、update-class、submit-task、register）
- **操作**:
  - 新建 `cloudfunctions/_shared/config.js`
  - 导出 `getConfigValue(db, key, defaultValue)` 和 `getConfigValues(db, keys, defaults)`
  - 各云函数删除本地实现，改为 `require('/opt/config')`
- **验证**: 抽奖、创建班级、创建任务等配置读取正常

### 1.5 改造 `addPointsLog` 支持事务

- **目标**: `start-draw` 复用 `_shared/points-log.js`
- **涉及文件**: `_shared/points-log.js`、`start-draw/index.js`
- **操作**:
  - 修改 `addPointsLog` 增加可选 `tx` 参数（事务上下文）
  - `start-draw` 中改用 `addPointsLog(transaction, {...})`
- **验证**: 抽奖后积分日志正确写入

---

## 阶段二：前端工具函数统一

消除 admin-web 前端页面中的重复代码。

### 2.1 统一 `formatDateTime`

- **目标**: 将 `formatDateTime` 提取到 `admin-web/src/utils/format.js`
- **涉及文件**: 10+ 个 Vue 页面
- **操作**:
  - 在 `format.js` 中添加 `formatDateTime` 函数
  - 各页面删除本地定义，改为 `import { formatDateTime } from '@/utils/format'`
- **验证**: 所有页面日期显示正常

### 2.2 统一 `formatPercent` 语义

- **目标**: 解决 `formatPercent` 语义不一致（0-1 vs 0-100）
- **涉及文件**: `PrizesPage.vue`、`admin-web/src/utils/format.js`
- **操作**:
  - 确定标准语义（建议统一为 0-1 输入，内部乘100）
  - 修改 `format.js` 中的实现
  - 检查所有调用方是否兼容
- **验证**: 奖品概率显示正确

### 2.3 新建 `@/constants/prize.js`

- **目标**: 统一 `typeOptions`、`getTypeLabel`、`statusOptions` 等
- **涉及文件**: `DrawRecordsPage.vue`、`PrizesPage.vue`
- **操作**:
  - 新建 `admin-web/src/constants/prize.js`
  - 导出 `PRIZE_TYPE_OPTIONS`、`getPrizeTypeLabel`、`PRIZE_STATUS_OPTIONS` 等
  - 两个页面改为从 constants 导入
- **验证**: 奖品管理和抽奖记录页面类型筛选正常

### 2.4 提取 `useTablePage` 组合式函数

- **目标**: 封装重复的分页/搜索/loading 模式
- **涉及文件**: 10+ 个管理页面
- **操作**:
  - 新建 `admin-web/src/composables/useTablePage.js`
  - 封装 `filters`、`loading`、`saving`、`handleSearch`、`handlePageChange`、`loadData` 模式
  - 各页面逐步迁移（可分批进行）
- **验证**: 各管理页面分页、搜索功能正常

---

## 阶段三：小程序代码统一

### 3.1 复用 `utils/format.js` 日期格式化

- **涉及文件**: `draw-records/draw-records.js`
- **操作**: 删除本地 `pad`/`formatTimeStr`，引入 `formatUtils.formatDate`
- **验证**: 抽奖记录时间显示正常

### 3.2 补充 `utils/constant.js` 文本映射

- **涉及文件**: `utils/constant.js`、`draw-records/draw-records.js`
- **操作**: 添加 `PRIZE_TYPE_TEXT`、`DRAW_RECORD_STATUS_TEXT`，删除本地 `TYPE_MAP`/`STATUS_MAP`
- **验证**: 抽奖记录状态和类型文本正确

### 3.3 清理空生命周期/方法/数据块

- **涉及文件**:
  - `login.js` 空 `onLoad` → 删除
  - `custom-navbar/index.js` 空 `data: {}` 和 `attached` → 删除
  - `loading/loading.js` 空 `methods: {}` → 删除
- **验证**: 组件功能不受影响

### 3.4 `announcement-panel` 复用 `getCurrentAnnouncement`

- **涉及文件**: `announcement-panel/index.js`
- **操作**: `handleRead` 中复用 `this.getCurrentAnnouncement()` 替代重复的数组校验
- **验证**: 公告阅读功能正常

### 3.5 `form.js` 合并两次 `setData`

- **涉及文件**: `form/form.js`
- **操作**: `onBirthdayPicker` 中合并为一次 `this.setData`
- **验证**: 生日选择器功能正常

---

## 阶段四：云函数效率优化

### 4.1 admin 列表查询下推过滤

- **涉及文件**: `admin-manage-draw-records/index.js`、`admin-manage-prizes/index.js`
- **操作**:
  - `status` 过滤移入 `where` 条件
  - `keyword` 过滤改用 `db.RegExp` 下推到数据库
  - 减少 `limit` 到合理值（200）
- **验证**: 管理后台列表查询正常，关键词搜索正常

### 4.2 `seedDefaultPrizes` 批量查询

- **涉及文件**: `admin-manage-prizes/index.js`
- **操作**: 一次性查询已存在的默认奖品名称，只创建缺失的
- **验证**: 初始化奖品功能正常

### 4.3 `redeemRecord` 原子更新

- **涉及文件**: `admin-manage-draw-records/index.js`
- **操作**: 改用条件更新 `where({ _id: id, is_redeemed: false })`，删除先检查后更新模式
- **验证**: 人工兑奖功能正常，重复兑奖被正确拒绝

### 4.4 `get-prizes` 添加软删除过滤

- **涉及文件**: `get-prizes/index.js`
- **操作**: 查询条件增加 `is_deleted: db.command.neq(true)`
- **验证**: 奖品列表不显示已删除奖品

### 4.5 `PointsLogPage.vue` 风格统一

- **涉及文件**: `PointsLogPage.vue`
- **操作**:
  - 创建 `admin-web/src/api/points-log.js` API 模块
  - 使用 `PageHeader` 组件
  - 使用 `MessagePlugin` 替代 `console.error`
  - 复用 `formatDateTime`
- **验证**: 积分日志页面功能和风格正常

---

## 阶段五：低优先级清理

### 5.1 字符串常量枚举化

- **涉及文件**: 多个前端和云函数文件
- **操作**: 定义 `STATUS`、`PRIZE_TYPE`、`VISIBILITY` 等常量对象
- **验证**: 功能不受影响

### 5.2 `normalizeUploadFileResponse` 简化

- **涉及文件**: `admin-web/src/api/cloudbase.js`
- **操作**: 提取 `getProperty(response, ...paths)` 工具函数替代 8 个 `||` 链
- **验证**: 文件上传功能正常

### 5.3 `lottery-wheel` 使用 `requestAnimationFrame`

- **涉及文件**: `lottery-wheel/index.js`
- **操作**: `setTimeout(animStep, 16)` 改为 `canvas.requestAnimationFrame(animStep)`
- **验证**: 转盘动画流畅

### 5.4 配置查询缓存（可选）

- **涉及文件**: `create-class/index.js`、`update-class/index.js`
- **操作**: 模块级缓存配置值（TTL 30秒）
- **验证**: 创建/更新班级功能正常

### 5.5 删除不必要注释

- **涉及文件**: `empty.js`、`loading.js`、`custom-navbar/index.js`、`_shared/points-log.js`
- **操作**: 删除文件路径注释和自描述 JSDoc
- **验证**: 无功能影响

---

## 进度跟踪

| 阶段 | 状态 | 完成项 | 总项 |
|------|------|--------|------|
| 阶段一：云函数共享模块 | ✅ 已完成 | 5 | 5 |
| 阶段二：前端工具函数统一 | ✅ 已完成 | 4 | 4 |
| 阶段三：小程序代码统一 | ✅ 已完成 | 5 | 5 |
| 阶段四：云函数效率优化 | ⬜ 未开始 | 0 | 5 |
| 阶段五：低优先级清理 | ⬜ 未开始 | 0 | 5 |
