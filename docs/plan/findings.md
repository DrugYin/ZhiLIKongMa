# 代码审查发现记录

## 审查范围

- **提交范围**: 最近20次提交（`7d0ad1a` ~ `d08c85f`）
- **变更规模**: +3089 行 / -37 行，涉及 41 个文件
- **审查维度**: 代码复用、代码质量、运行时效率

---

## 已修复的问题（7个）

| # | 问题 | 文件 | 修复方式 | 提交 |
|---|------|------|---------|------|
| 1 | `.env.example` 暴露真实 JWT 令牌 | `admin-web/.env.example` | 替换为占位符 | `959ab5a` |
| 2 | `start-draw` 4次串行DB查询 | `start-draw/index.js` | 批量查询 + `Promise.all` | `959ab5a` |
| 3 | `start-draw` 事务内多余 prize 查询 | `start-draw/index.js` | 删除，用条件更新替代 | `959ab5a` |
| 4 | `get-draw-records` 3次串行查询 | `get-draw-records/index.js` | `Promise.all` 并行化 | `959ab5a` |
| 5 | `lottery.js` 冗余 getUserInfo 请求 | `lottery.js` | 删除 | `959ab5a` |
| 6 | `lottery.js` onCloseResult 全量刷新 | `lottery.js` | 仅关闭弹窗 | `959ab5a` |
| 7 | `lottery.wxml` 5次重复方法调用 | `lottery.wxml` + `lottery.js` | 预计算存入 data | `959ab5a` |

---

## 未修复的问题（24个）

### 严重（3个）

**S1: verifyAdmin/hasRole/getCallerUid 13个文件逐字复制**
- 文件: 所有 `admin-*` 云函数
- 根因: 缺少共享的 admin 认证模块
- 影响: 修改验证逻辑需同步改13个文件，容易遗漏
- 修复方案: 新建 `_shared/admin-auth.js`

**S2: success/failure 15个文件重复定义**
- 文件: 大部分云函数
- 根因: 已有 `_shared/response.js` 但未被广泛采用
- 影响: 返回格式不一致风险
- 修复方案: 统一引用 `_shared/response.js`

**S3: start-draw 未复用 addPointsLog**
- 文件: `start-draw/index.js`
- 根因: `_shared/points-log.js` 的 `addPointsLog` 不支持事务参数
- 影响: 积分日志时间字段使用 `new Date()` 而非 `db.serverDate()`，可能存在时区差异
- 修复方案: 改造 `addPointsLog` 支持可选事务参数

### 中等（8个）

**M1: getConfigValue 6个云函数重复实现**
- 文件: start-draw、create-class、create-task、update-class、submit-task、register
- 修复方案: 新建 `_shared/config.js`

**M2: normalizeString 21个文件重复**
- 文件: 几乎所有云函数
- 修复方案: 新建 `_shared/utils.js`

**M3: formatDateTime 10+个 Vue 页面重复**
- 文件: 所有 admin-web 管理页面
- 修复方案: 提取到 `@/utils/format.js`

**M4: 分页处理模式未提取**
- 文件: 10+个管理页面
- 修复方案: 创建 `useTablePage` 组合式函数

**M5: PointsLogPage 风格不一致**
- 文件: `PointsLogPage.vue`
- 问题: 未用 API 封装、未用 PageHeader、用 console.error 代替 MessagePlugin
- 修复方案: 创建 API 模块，统一风格

**M6: seedDefaultPrizes N+1 查询**
- 文件: `admin-manage-prizes/index.js`
- 修复方案: 批量查询已存在奖品

**M7: redeemRecord 非原子操作**
- 文件: `admin-manage-draw-records/index.js`
- 修复方案: 条件更新替代先检查后更新

**M8: admin 列表全表扫描+内存过滤**
- 文件: `admin-manage-draw-records/index.js`、`admin-manage-prizes/index.js`
- 修复方案: status 过滤下推到 where，keyword 改用 db.RegExp

### 轻微（13个）

**L1**: `draw-records.js` 重写日期格式化，已有 `utils/format.js`
**L2**: `TYPE_MAP`/`STATUS_MAP` 重复定义，已有 `utils/constant.js`
**L3**: `formatPercent` 语义不一致（0-1 vs 0-100）
**L4**: `typeOptions`/`getTypeLabel` 两个页面重复
**L5**: `announcement-panel` 重复数组校验
**L6**: `login.js` 空 `onLoad`
**L7**: `custom-navbar` 空 `data: {}` 和 `attached`
**L8**: `loading` 空 `methods: {}`
**L9**: 字符串类型化的状态值未定义为常量枚举
**L10**: `normalizeUploadFileResponse` 8个 `||` 链式取值
**L11**: `form.js` `onBirthdayPicker` 两次 `setData` 可合并
**L12**: `get-prizes` 缺少 `is_deleted` 软删除过滤
**L13**: `lottery-wheel` 用 `setTimeout` 而非 `requestAnimationFrame`

---

## 关键模式总结

### 重复代码热点

| 模式 | 重复次数 | 涉及文件数 |
|------|---------|-----------|
| `normalizeString` | 21 | 21 |
| `verifyAdmin`/`hasRole`/`getCallerUid` | 13 | 13 |
| `success`/`failure` | 15 | 15 |
| `formatDateTime` | 11 | 11 |
| `getConfigValue` | 6 | 6 |
| 分页处理模式 | 10+ | 10+ |

### 根因分析

1. **缺少共享模块意识**: `_shared/` 目录已有良好基础（`response.js`、`auth.js`、`points-log.js`），但新开发的云函数未充分复用
2. **复制粘贴开发习惯**: 新功能开发时从已有文件复制代码，而非引用共享模块
3. **前端工具函数分散**: `admin-web/src/utils/format.js` 存在但内容不完整，各页面自行定义通用函数
4. **缺少组合式函数**: Vue 3 的 `composables` 模式未被利用，重复的页面逻辑未提取

---

## 建议的共享模块架构

```
cloudfunctions/_shared/
├── admin-auth.js      # verifyAdmin, hasRole, getCallerUid
├── config.js          # getConfigValue, getConfigValues
├── points-log.js      # addPointsLog (已有，需改造)
├── response.js        # success, failure (已有)
└── utils.js           # normalizeString, tryParseInt, tryParseFloat

admin-web/src/
├── composables/
│   └── useTablePage.js  # 分页/搜索/loading 通用逻辑
├── constants/
│   └── prize.js         # 奖品类型/状态选项和标签
└── utils/
    └── format.js        # formatDateTime, formatPercent, formatNumber
```
