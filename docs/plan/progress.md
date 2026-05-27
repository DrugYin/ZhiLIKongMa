# 修复进度日志

## 2026-05-27

### 已完成

**代码审查**（3个并行代理）
- 代码复用审查：发现11个问题（3严重/4中等/4低）
- 代码质量审查：发现16个问题（4严重/6中等/6轻微）
- 效率审查：发现14个问题（5高/5中/4低）
- 去重后共41个独立问题

**第一轮修复**（分支 `fix/code-review-cleanup`，提交 `959ab5a`）
- 修复7个问题（1安全/5性能/1代码冲突）
- 涉及6个文件，+60/-59 行

**修复计划制定**
- 创建 `docs/plan/task_plan.md`：5个阶段，24个修复项
- 创建 `docs/plan/findings.md`：问题详情和根因分析
- 创建 `docs/plan/progress.md`：本文件

**阶段一：云函数共享模块提取**（分支 `codex-phase-1-cloudfunctions-shared`）
- 新增 `_shared/admin-auth.js`，统一 `verifyAdmin`、`hasRole`、`getCallerUid`
- 新增 `_shared/utils.js`，统一 `normalizeString`、`tryParseInt`、`tryParseFloat`
- 新增 `_shared/config.js`，统一配置读取
- 统一云函数 `success`/`failure` 引用 `_shared/response.js`
- 改造 `_shared/points-log.js` 支持数据库实例或事务上下文，并迁移 `start-draw`
- 同步更新 `cloudfunctions/_shared.zip`
- 新增 `tests/shared-modules.test.js` 作为共享模块回归测试

**阶段二：前端工具函数统一**（分支 `codex-phase-2-admin-web-utils`）
- 在 `admin-web/src/utils/format.js` 统一 `formatDateTime` 和 0-1 输入语义的 `formatPercent`
- 新增 `admin-web/src/constants/prize.js`，统一奖品类型/状态选项和标签
- 新增 `admin-web/src/composables/useTablePage.js`，封装列表页 loading、筛选、分页、请求流程
- 清理 11 个管理页面中的本地 `formatDateTime`
- 迁移用户、班级两个主列表页面接入 `useTablePage`
- 新增 admin-web 工具与组合式函数测试

**阶段三：小程序代码统一**（分支 `codex-phase-3-miniprogram-cleanup`）
- 抽奖记录页复用 `utils/format.js` 和 `utils/constant.js`
- 补充 `PRIZE_TYPE_TEXT`、`DRAW_RECORD_STATUS_TEXT`
- 删除登录页、导航栏、加载组件中的空生命周期/空数据/空方法
- `announcement-panel` 阅读逻辑复用当前公告读取结果
- 合并生日选择器中的两次 `setData`
- 新增小程序常量回归测试

**阶段四：云函数效率优化**（分支 `codex-phase-4-efficiency-polish`）
- `admin-manage-draw-records` 下推关键词过滤，列表限制降为 200，并将人工兑奖改为条件更新
- `admin-manage-prizes` 下推状态/关键词过滤，列表限制降为 200，并批量查询默认奖品是否存在
- `get-prizes` 增加软删除过滤
- 新增 `admin-web/src/api/points-log.js`
- `PointsLogPage.vue` 接入 `PageHeader`、`MessagePlugin`、`formatDateTime` 和积分日志 API 模块
- 新增阶段四静态回归测试

**阶段五：低优先级清理**（分支 `codex-phase-5-low-priority-cleanup`）
- `normalizeUploadFileResponse` 改用 `getProperty` 路径读取工具
- `lottery-wheel` 动画调度改用 canvas `requestAnimationFrame`
- `create-class`、`update-class` 添加 30 秒配置缓存
- 清理 `empty`、`loading`、`custom-navbar`、`points-log` 中的自描述注释和空数据块
- 同步更新 `cloudfunctions/_shared.zip`
- 新增阶段五静态回归测试

---

## 待办

### 阶段一：云函数共享模块提取
- [x] 1.1 新建 `_shared/admin-auth.js`
- [x] 1.2 统一 `success`/`failure` 引用
- [x] 1.3 新建 `_shared/utils.js`
- [x] 1.4 新建 `_shared/config.js`
- [x] 1.5 改造 `addPointsLog` 支持事务

### 阶段二：前端工具函数统一
- [x] 2.1 统一 `formatDateTime`
- [x] 2.2 统一 `formatPercent` 语义
- [x] 2.3 新建 `@/constants/prize.js`
- [x] 2.4 提取 `useTablePage` 组合式函数（已迁移用户、班级主列表，其余复杂页面可后续分批接入）

### 阶段三：小程序代码统一
- [x] 3.1 复用 `utils/format.js`
- [x] 3.2 补充 `utils/constant.js` 文本映射
- [x] 3.3 清理空生命周期/方法/数据块
- [x] 3.4 `announcement-panel` 复用方法
- [x] 3.5 `form.js` 合并 `setData`

### 阶段四：云函数效率优化
- [x] 4.1 admin 列表查询下推过滤
- [x] 4.2 `seedDefaultPrizes` 批量查询
- [x] 4.3 `redeemRecord` 原子更新
- [x] 4.4 `get-prizes` 添加软删除过滤
- [x] 4.5 `PointsLogPage.vue` 风格统一

### 阶段五：低优先级清理
- [x] 5.1 字符串常量枚举化
- [x] 5.2 `normalizeUploadFileResponse` 简化
- [x] 5.3 `lottery-wheel` 使用 `requestAnimationFrame`
- [x] 5.4 配置查询缓存
- [x] 5.5 删除不必要注释
