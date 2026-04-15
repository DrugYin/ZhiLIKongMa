# 代码审查报告（全仓库静态巡检）

> 审查日期：2026-04-15
> 范围：前端小程序 + cloudfunctions + services/utils
> 方法：全量文件静态阅读 + 批量关键字扫描 + 接口一致性核对

## 高优先级问题（建议优先处理）

### 1) 登录页路由写错，可能导致“跳转登录页失败”
- **位置**：`services/auth.js`
- **现状**：`navigateToLogin` 使用 `/pages/login/index`，但实际页面路径是 `/pages/login/login`。
- **风险**：在未登录/鉴权失败场景下可能无法跳转，影响核心流程。
- **建议**：统一改为 `/pages/login/login` 并全局检索类似硬编码路径。

### 2) API 层定义了不存在的云函数，调用后必然失败
- **位置**：`services/api.js`
- **现状**：存在 `get-prizes`、`start-draw`、`get-draw-records`、`get-config` 的调用封装，但仓库中无对应 `cloudfunctions/<name>/index.js`。
- **风险**：一旦页面或业务逻辑触发这些 API，会直接报错。
- **建议**：
  - 若功能已下线：删除对应 API，并在调用处加兜底提示；
  - 若功能仍在规划：补齐云函数并在 `CLOUD_FUNCTIONS_API.md` 更新状态。

### 3) 班级邀请码生成存在并发竞争窗口
- **位置**：`cloudfunctions/create-class/index.js`
- **现状**：先查询 `class_code` 是否存在，再执行 `add`。并发请求下，两次请求可能都“查无此码”然后插入同码。
- **风险**：出现重复邀请码，造成后续加入班级逻辑混乱。
- **建议**：
  - 数据库层对 `class_code` 建唯一索引（首选）；
  - 插入时捕获唯一键冲突并重试生成。

## 中优先级问题（建议尽快处理）

### 4) 注册表单打印完整用户信息到日志（隐私风险）
- **位置**：`pages/login/login.js`
- **现状**：`validateForm` 里直接 `console.log('userInfo', userInfo)`。
- **风险**：日志可能包含手机号、学校等个人信息。
- **建议**：生产环境移除；若需要调试，做字段脱敏后打印。

### 5) 生日选择器取消逻辑疑似写错状态字段
- **位置**：`components/form/form.js`
- **现状**：`onPickerCancel` 无论场景都只关闭 `gradePickerVisible`，而生日弹窗由 `birthdayPickerVisible` 控制。
- **风险**：某些交互链路下可能出现弹窗状态不一致。
- **建议**：区分年级/生日两个 cancel 处理或按 `dataset.type` 关闭对应弹层。

### 6) 生日默认值依赖 `toLocaleDateString()`，格式不可控
- **位置**：`components/form/form.js`
- **现状**：`date` 默认值来自 `new Date().toLocaleDateString()`。
- **风险**：不同机型/语言环境可能输出 `YYYY/M/D`、`M/D/YYYY` 等，和组件期望格式不一致时会出错。
- **建议**：统一输出 `YYYY-MM-DD`（例如手动格式化）。

## 低优先级优化建议

### 7) 云环境 ID 在前端硬编码，建议配置化
- **位置**：`app.js`
- **现状**：`wx.cloud.init({ env: 'zhi-li-kong-ma-7gy2aqcr1add21a7' })`。
- **风险**：多环境切换（开发/测试/生产）易误配；代码可移植性差。
- **建议**：改为构建配置/环境变量注入，或读取统一配置文件。

### 8) 文案提示“可能有数据丢失”长期保留会影响信任
- **位置**：`app.js`
- **现状**：启动公告包含“仍存在部分 bug 和数据丢失情况”。
- **风险**：长期显示会降低用户信任且增加客服压力。
- **建议**：改为版本化公告机制（仅新版本首登展示，可后台开关）。

---

## 我执行过的检查命令（可复现）

1. `rg --files`（全量文件清单）
2. `rg -n "TODO|FIXME|console\.log|wx\.cloud\.callFunction\(|..." --glob "**/*.js"`（风险模式扫描）
3. `node` 脚本比对 `services/api.js` 的云函数名与 `cloudfunctions/` 目录一致性
4. `node` 脚本对全部 `.js` 文件做语法检查（`new Function`）

