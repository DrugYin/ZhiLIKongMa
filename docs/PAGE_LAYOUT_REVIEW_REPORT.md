# 智慧控码训练系统 - 页面布局设计审查报告

**文档版本**: v1.1.0
**审查日期**: 2026-05-07
**最后更新**: 2026-05-07（P0 问题已修复）
**审查范围**: 微信小程序端 + 后台管理网站
**审查人**: Claude Code

---

## 目录

- [一、审查概述](#一审查概述)
- [二、小程序端审查结果](#二小程序端审查结果)
  - [2.1 整体架构概览](#21-整体架构概览)
  - [2.2 发现的主要问题](#22-发现的主要问题)
  - [2.3 组件层面问题](#23-组件层面问题)
  - [2.4 用户体验问题](#24-用户体验问题)
- [三、后台管理端审查结果](#三后台管理端审查结果)
  - [3.1 页面结构问题](#31-页面结构问题)
  - [3.2 组件使用问题](#32-组件使用问题)
  - [3.3 响应式设计问题](#33-响应式设计问题)
  - [3.4 用户体验问题](#34-用户体验问题)
  - [3.5 样式一致性问题](#35-样式一致性问题)
- [四、优化建议汇总](#四优化建议汇总)
  - [4.1 小程序端优化建议](#41-小程序端优化建议)
  - [4.2 后台管理端优化建议](#42-后台管理端优化建议)
- [五、优先级行动计划](#五优先级行动计划)
  - [5.1 第一阶段：架构优化](#51-第一阶段架构优化)
  - [5.2 第二阶段：体验优化](#52-第二阶段体验优化)
  - [5.3 第三阶段：细节打磨](#53-第三阶段细节打磨)
- [六、快速收益建议](#六快速收益建议)

---

## 修复记录

### 2026-05-07 P0 问题修复

**修复内容：** 解决小程序端全部 3 个 P0 级别问题

| 问题 | 修复方案 | 涉及文件 |
|------|----------|----------|
| P0-1 样式重复 | 创建 `styles/common.wxss` 提取通用样式，`app.wxss` 通过 `@import` 引入，22 个页面 wxss 移除重复代码 | 24 个文件 |
| P0-2 container 布局不一致 | 统一为 flex 纵向布局 + `overflow: hidden`，定义在 `common.wxss` | 全局 |
| P0-3 content 高度计算不一致 | 统一为 `flex: 1; min-height: 0`，消除所有 `calc()` 硬编码 | 全局 |

**关键文件变更：**
- `miniprogram/styles/common.wxss` — 新建，包含所有通用样式
- `miniprogram/app.wxss` — 简化为 `@import common.wxss` + 页面背景
- 22 个页面 wxss — 移除重复样式，仅保留页面特有覆盖

---

## 一、审查概述

### 1.1 审查目的

本次审查旨在全面评估智慧控码训练系统的小程序端和后台管理端的页面布局设计，识别存在的问题并提供优化建议，以提升代码质量、用户体验和维护效率。

### 1.2 审查范围

- **微信小程序端**: 22个页面，5个自定义组件
- **后台管理端**: 10个页面，4个公共组件

### 1.3 审查维度

1. 页面结构合理性
2. 样式一致性
3. 组件使用恰当性
4. 响应式设计
5. 用户体验

---

## 二、小程序端审查结果

### 2.1 整体架构概览

项目分为学生端（11个页面）、教师端（9个页面）、公共页面（1个）和登录页（1个），共5个自定义组件。整体采用统一的 card-based 设计语言，视觉风格基本一致。

**页面分布：**

| 端 | 页面数 | 主要功能 |
|---|--------|----------|
| 学生端 | 11 | 首页、任务管理、班级管理、排行榜、我的、设置 |
| 教师端 | 9 | 首页、任务管理、班级管理、审核中心、我的 |
| 公共 | 1 | 通知中心 |
| 登录 | 1 | 登录/注册 |

### 2.2 发现的主要问题

#### 问题 1：大量样式重复定义，缺少全局样式表

**严重程度：** P0（最高） | **状态：✅ 已解决**

**问题描述：**

几乎每个页面的 wxss 文件都独立定义了 `.container`、`.hero-card`、`.section-card`、`.primary-btn`、`.ghost-btn`、`.summary-grid`、`.summary-item` 等完全相同的样式规则。

**修复方案：**

1. 创建 `miniprogram/styles/common.wxss`，提取所有通用样式（容器布局、卡片系统、按钮系统、统计网格、空状态等）
2. 修改 `miniprogram/app.wxss`，通过 `@import './styles/common.wxss'` 引入共享样式
3. 更新全部 22 个页面 wxss 文件，移除与 `common.wxss` 重复的样式定义，仅保留页面特有的覆盖样式

**涉及文件（22个 wxss 文件）：**

- `miniprogram/pages/student/index.wxss`
- `miniprogram/pages/student/mine/mine.wxss`
- `miniprogram/pages/student/rank/rank.wxss`
- `miniprogram/pages/student/class-manage/class-manage.wxss`
- `miniprogram/pages/student/class-manage/class-detail/class-detail.wxss`
- `miniprogram/pages/student/class-manage/join-confirm/join-confirm.wxss`
- `miniprogram/pages/student/task-manage/task-manage.wxss`
- `miniprogram/pages/student/task-manage/task-detail/task-detail.wxss`
- `miniprogram/pages/student/task-manage/submission-edit/submission-edit.wxss`
- `miniprogram/pages/student/task-manage/submission-records/submission-records.wxss`
- `miniprogram/pages/teacher/index.wxss`
- `miniprogram/pages/teacher/mine/mine.wxss`
- `miniprogram/pages/teacher/class-manage/class-manage.wxss`
- `miniprogram/pages/teacher/class-manage/class-detail/class-detail.wxss`
- `miniprogram/pages/teacher/class-manage/class-edit/class-edit.wxss`
- `miniprogram/pages/teacher/task-manage/task-manage.wxss`
- `miniprogram/pages/teacher/task-manage/task-detail/task-detail.wxss`
- `miniprogram/pages/teacher/task-manage/task-edit/task-edit.wxss`
- `miniprogram/pages/teacher/pending/pending.wxss`
- `miniprogram/pages/common/announcements/announcements.wxss`
- `miniprogram/pages/login/login.wxss`
- `miniprogram/pages/student/setting/setting.wxss`

---

#### 问题 2：`.container` 布局模式不一致

**严重程度：** P0 | **状态：✅ 已解决**

**问题描述：**

不同页面的 `.container` 使用了三种不同的布局策略。

**修复方案：**

统一采用策略 B（flex 纵向布局 + `overflow: hidden`），在 `common.wxss` 中定义：

```css
.container {
  height: 100vh;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  overflow: hidden;
  background: linear-gradient(180deg, #f7f8fa 0%, #eef2f7 100%);
}
```

移除了原 `app.wxss` 中的 `justify-content: space-between` 定义。登录页因布局特殊（居中登录卡片），保留了页面级覆盖。

---

#### 问题 3：`.content` 的高度计算方式不统一

**严重程度：** P0 | **状态：✅ 已解决**

**问题描述：**

各页面对滚动内容区的高度计算差异明显，存在多种 `calc()` 方式和不同的底部 padding 值。

**修复方案：**

在 `common.wxss` 中统一使用 flex 自适应布局，消除所有 `calc()` 硬编码：

```css
.content {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 0rpx 24rpx;
}
```

`.content` 不再需要 `height: calc(100vh - Xrpx)`，由 flex 布局自动填充剩余空间。页面级 wxss 仅在需要额外底部间距时（如有固定底栏的页面）覆盖 `padding-bottom`。

---

#### 问题 4：教师端 `class-manage.wxml` 中 `header-spacer` 的布局 hack

**严重程度：** P1

**问题描述：**

文件：`miniprogram/pages/teacher/class-manage/class-manage.wxml`，第 15 行

```html
<view class="header-spacer"></view>
```

教师端班级管理页面因为 header 中有下拉筛选菜单，使用了一个 `header-spacer` 来撑开空间。这是一个布局 hack，说明 `custom-navbar` 组件的 `placeholder` 属性无法覆盖有额外头部内容的场景。

**建议：**

改为让 `.header` 包含完整的头部区域（navbar + dropdown），并确保 `.content` 在 flex 布局下自动填充剩余空间。

---

#### 问题 5：学生端与教师端的相同页面结构不一致

**严重程度：** P1

**问题描述：**

学生端和教师端存在多个功能对称的页面，但结构存在差异：

| 差异点 | 学生端 | 教师端 |
|--------|--------|--------|
| 我的页面头像 | 使用 `<image class="avatar-image">` 展示头像 | 没有头像展示，只有文字信息 |
| 班级管理列表 | 使用 `scroll-view` 包裹 | 使用 `scroll-view` + `dropdown-wrapper` |
| 任务管理操作 | 使用 tab-bar 底部导航 | 使用 `t-fab` 浮动按钮 |
| custom-navbar 使用 | 直接使用 `placeholder="{{true}}"` | 额外包裹 `<view class="navbar-wrapper">` |

**建议：**

统一 `custom-navbar` 的使用方式，去掉不必要的 `navbar-wrapper` 包裹层。

---

#### 问题 6：`empty` 组件未被使用

**严重程度：** P2

**问题描述：**

文件：`miniprogram/components/empty/empty.wxml`

项目定义了 `empty` 组件（支持 icon、title、description、button），但审查所有页面 wxml 后发现，没有任何页面使用 `<empty>` 组件。所有页面的空状态都是内联实现的：

```html
<view class="empty-card">
  <text class="empty-title">还没有加入任何班级</text>
  <text class="empty-desc">可以先输入邀请码申请加入...</text>
</view>
```

**影响：**

大量重复的空状态结构代码，且不同页面的空状态样式略有差异。

**建议：**

统一使用 `empty` 组件，或废弃该组件并在全局样式中统一 `.empty-card` 的样式。

---

#### 问题 7：`loading` 组件未被使用

**严重程度：** P2

**问题描述：**

文件：`miniprogram/components/loading/loading.wxml`

`loading` 组件定义了完整的加载动画（8个旋转圆点），但所有页面的加载状态都是用内联文本实现的：

```html
<view class="state-card">
  <text class="state-title">任务列表加载中</text>
  <text class="state-desc">正在同步你当前可查看的任务内容。</text>
</view>
```

**建议：**

要么将加载动画集成到页面中提升体验，要么移除未使用的 `loading` 组件以减小包体积。

---

#### 问题 8：`form` 组件样式与整体设计语言不一致

**严重程度：** P1

**问题描述：**

文件：`miniprogram/components/form/form.wxss`

- `form` 组件使用了 `px` 单位（`padding: 20px`），而整个项目的其他样式都使用 `rpx`
- `.form-page` 的背景色 `#fff`、圆角 `20px`、边框等与页面级卡片样式不一致
- `setting.wxss` 中用 `!important` 覆盖了 form 组件的样式

```css
/* setting.wxss */
.avatar-wrapper {
  padding: 0;
  width: 160rpx !important;
  border-radius: 16rpx;
}
```

**建议：**

统一 `form` 组件的单位为 `rpx`，使其卡片样式与全局设计语言对齐，消除 `!important` 覆盖。

---

#### 问题 9：设置页（setting）样式严重脱节

**严重程度：** P1

**问题描述：**

文件：`miniprogram/pages/student/setting/setting.wxss`

设置页只定义了 30 行样式，与其他页面的完整设计语言完全不同：

- `.content` 使用 `background-color: #f3f3f3` 而非全局的渐变背景
- 没有定义 `.hero-card`、`.section-card` 等卡片样式
- 没有 `scroll-view` 包裹，直接使用普通 `view`，内容可能溢出
- 没有定义 `summary-grid` 等通用组件样式

**建议：**

重写设置页的布局，采用与其他页面一致的 card-based 布局和渐变背景。

---

#### 问题 10：登录页注册表单的间距问题

**严重程度：** P2

**问题描述：**

文件：`miniprogram/pages/login/login.wxml`，第 29-33 行

```html
<form-component wx:else id="register-form" userInfo="{{userInfo}}" >
  <view class="action-wrapper" >
    <t-button class="register-btn" ...>注册</t-button>
  </view>
</form-component>
```

注册流程使用 `form-component`，但登录页面的 `.content` 没有使用 `scroll-view`。如果用户在小屏设备上操作，注册表单（包含头像、姓名、学校、年级、电话、生日、地址共 7 个字段）可能无法完整显示。

**建议：**

为登录页的注册流程添加 `scroll-view` 包裹，或设置 `.content` 的 `overflow-y: auto`。

---

#### 问题 11：`hero-card` 渐变背景值不统一

**严重程度：** P1

**问题描述：**

不同页面的 `.hero-card` 渐变背景存在细微差异：

| 页面 | 渐变背景 |
|------|----------|
| 大部分页面 | `linear-gradient(135deg, #ffffff 0%, #eef6ff 54%, #f8fbff 100%)` |
| join-confirm | `linear-gradient(135deg, #ffffff 0%, #eff7ff 54%, #f8fbff 100%)` |
| task-manage | `linear-gradient(135deg, #ffffff 0%, #eef6ff 52%, #f5fbff 100%)` |
| submission-records | `linear-gradient(135deg, #ffffff 0%, #f0f7ff 50%, #f8fbff 100%)` |

**建议：**

提取到全局样式中统一定义。

---

#### 问题 12：`summary-value` 字体大小不一致

**严重程度：** P1

**问题描述：**

不同页面对 `.summary-value` 的 `font-size` 定义不同：

| 字体大小 | 使用页面 |
|----------|----------|
| `30rpx` | 学生首页、任务管理页、提交记录页 |
| `28rpx` | 学生我的页、教师我的页、排行榜、班级管理页、班级详情页、join-confirm、提交编辑页 |

**建议：**

统一为一个值（建议 `28rpx` 或 `30rpx`），在全局样式中定义。

---

#### 问题 13：排行榜页 `summary-grid` 布局限制

**严重程度：** P2

**问题描述：**

教师端审核中心的 `summary-grid` 包含 6 个 `summary-item`，但 `summary-item` 的宽度固定为 `calc(50% - 10rpx)`（两列布局），6 项会自动换行成 3 行。

**建议：**

对于统计卡片数量较多的场景，考虑支持三列布局（`width: calc(33.333% - 12rpx)`），可以通过给 `summary-grid` 添加一个 modifier class 来实现。

---

#### 问题 14：按钮类名碎片化

**严重程度：** P1

**问题描述：**

项目中定义了大量语义相同但类名不同的按钮样式：

| 类名 | 使用位置 |
|------|----------|
| `.primary-btn` | 多个页面 |
| `.ghost-btn` | 多个页面 |
| `.primary-action-btn` | 学生任务详情页 |
| `.ghost-action-btn` | 学生任务详情页 |
| `.submit-btn` | 学生提交编辑页 |
| `.share-btn` | 教师任务详情页、教师班级详情页 |
| `.danger-btn` | 教师审核中心 |
| `.reject-btn` / `.approve-btn` | 教师班级详情页 |
| `.remove-btn` | 教师班级详情页 |
| `.block-btn` | 学生首页 |
| `.file-add-btn` | 提交编辑页、任务编辑页 |
| `.read-btn` | 通知中心页 |
| `.load-more-btn` | 提交记录页 |
| `.ghost-copy-btn` | 学生任务详情页 |
| `.action-btn` / `.action-btn-secondary` / `.action-btn-danger` | 教师班级管理、教师任务管理 |
| `.login-btn` / `.register-btn` | 登录页 |

**建议：**

建立统一的按钮系统，基础类 `.btn` + 修饰类 `.btn-primary`、`.btn-ghost`、`.btn-danger`、`.btn-block` 等。

---

#### 问题 15：`z-index` 值不统一

**严重程度：** P1

**问题描述：**

不同页面的 `.header` 使用了不同的 `z-index` 值：

| z-index | 使用页面 |
|---------|----------|
| `10` | 学生首页、学生我的页、设置页、join-confirm、排行榜 |
| `20` | 学生任务管理、学生提交编辑、学生提交记录、学生班级详情 |
| `100` | 教师班级管理 |

**影响：**

可能导致某些场景下弹出层与导航栏的层叠关系不可预测。

**建议：**

统一使用相同的 `z-index` 值（如 `10`），或建立 z-index 层级规范。

---

#### 问题 16：`scroll-view` 属性使用不一致

**严重程度：** P2

**问题描述：**

部分页面的 `scroll-view` 添加了 `bounces="{{false}}" show-scrollbar="{{false}}"`，而其他页面没有设置这两个属性。

| 有设置 | 无设置 |
|--------|--------|
| 学生任务管理、学生任务详情、学生提交编辑、学生提交记录、教师任务管理、教师任务详情 | 学生首页、学生我的页、排行榜、班级管理、班级详情、join-confirm、教师首页、教师我的页、审核中心、通知中心 |

**建议：**

统一所有 `scroll-view` 的行为，建议全部添加 `bounces="{{false}}" show-scrollbar="{{false}}"`。

---

#### 问题 17：缺少下拉刷新功能

**严重程度：** P2

**问题描述：**

所有页面的 `scroll-view` 都使用了 `enhanced` 属性，但没有页面使用下拉刷新功能（`refresher-enabled`）。对于列表类页面（任务列表、班级列表、审核列表、通知列表）来说，缺少下拉刷新会影响用户体验。

**建议：**

为列表类页面添加 `refresher-enabled` 支持。

---

#### 问题 18：部分页面缺少 `t-toast` 组件

**严重程度：** P2

**问题描述：**

`miniprogram/pages/student/mine/mine.wxml` 引入了 `<t-toast id="t-toast" />`，但其他需要显示 toast 的页面（如任务管理、班级管理等执行删除操作的页面）没有引入该组件。

**建议：**

将 `t-toast` 放入全局配置（`app.json` 的 `usingComponents`）或统一在需要的页面引入。

---

### 2.3 组件层面问题

#### 组件 1：`custom-navbar` -- 实现过于简单

**文件：** `miniprogram/components/custom-navbar/index.wxml`

组件只有一行有效代码，直接透传属性给 `t-navbar`。组件本身没有额外价值，且注释掉的占位代码说明开发者对占位逻辑有过困惑。

**建议：**

如果 `t-navbar` 的 `placeholder` 属性已足够，这个包装组件可以简化甚至去掉。

---

#### 组件 2：`announcement-panel` -- 样式与全局风格一致

该组件的样式与全局设计语言对齐，按钮样式复用了 `.primary-btn` 和 `.ghost-btn`。这是项目中组件化做得最好的一个。

---

#### 组件 3：`empty` 组件 -- 设计语言与项目不匹配

**文件：** `miniprogram/components/empty/empty.wxss`

该组件使用 emoji 作为图标（📭🔍📊🌐📋💬），背景色 `#f5f5f5`、按钮颜色 `#007aff`、文字颜色 `#333333` / `#999999` 等都与项目的蓝色系设计语言（`#1f7ae0`、`#17314a`、`#65788c`）不匹配。这可能是该组件未被实际使用的原因之一。

---

#### 组件 4：`form` 组件 -- 使用 px 单位

如前述，`form` 组件的样式使用 `px` 而非 `rpx`，在不同屏幕尺寸上可能出现比例问题。

---

### 2.4 用户体验问题

#### UX 1：学生端任务管理页缺少底部安全区域

**文件：** `miniprogram/pages/student/task-manage/task-manage.wxss`

`.content` 的 padding 为 `0rpx 24rpx`，没有底部安全区域 padding。但由于页面有 `t-tab-bar` 底部导航栏（通过 `placeholder` 属性占位），实际内容不会被遮挡。不过，如果 tab-bar 的高度计算不精确，最后一条任务卡片可能被部分遮挡。

---

#### UX 2：教师端审核中心的弹出层操作按钮位置

**文件：** `miniprogram/pages/teacher/pending/pending.wxml`，第 514-517 行

审核弹出层中的"驳回"和"通过"按钮放在了弹出层的最底部（`popup-action-row`），但在长表单场景下（包含评分、积分、处理意见、图片、附件），用户需要滚动很长才能看到操作按钮。

**建议：**

将操作按钮固定在弹出层底部。

---

#### UX 3：学生端提交编辑页的固定底栏

**文件：** `miniprogram/pages/student/task-manage/submission-edit/submission-edit.wxss`

该页面有固定的 `.footer` 底栏（提交按钮），使用了 `position: fixed`。但 `.content` 的 `footer-placeholder` 高度为 `160rpx`，如果固定底栏的实际高度（包含 `safe-area-inset-bottom`）与 160rpx 不匹配，可能导致底部内容被遮挡或出现多余空白。

---

#### UX 4：班级管理学生端的 `hero-card` 内信息过多

**文件：** `miniprogram/pages/student/class-manage/class-manage.wxml`

该页面在同一个 `scroll-view` 中放置了：hero 卡片、加载状态、未登录提示、班级概览、邀请码输入、已加入班级列表（每个班级还有详情面板）、待审核申请列表、加入方式说明。页面内容非常长。

**建议：**

考虑分 tab 或分页展示。

---

## 三、后台管理端审查结果

### 3.1 页面结构问题

#### 问题 1.1：路由采用全量导入，缺乏懒加载

**严重程度：** 高

**文件：** `admin-web/src/router/index.js`

所有 10 个页面组件在路由定义时被同步 import，会导致首屏打包体积过大。

**建议改为动态 import：**

```javascript
const DashboardPage = () => import('@/pages/dashboard/DashboardPage.vue');
```

---

#### 问题 1.2：AdminLayout 侧边栏缺少图标和面包屑

**严重程度：** 中

**文件：** `admin-web/src/layouts/AdminLayout.vue`

**问题点：**

- 菜单项只有纯文本，没有图标，用户扫视效率低
- 没有面包屑导航，当页面层级较深时用户容易迷失位置
- 收起/展开按钮使用文字"展开"/"收起"，应改为图标以节省空间
- 侧边栏宽度通过内联绑定实现，建议改为 CSS class 切换

**建议：**

- 为每个菜单项配置 TDesign 的 `icon` 属性
- 添加面包屑组件
- 使用 `MenuUnfoldOutlined` / `MenuFoldOutlined` 图标

---

#### 问题 1.3：页面文件过大，缺乏逻辑拆分

**严重程度：** 中

| 页面 | 行数 | 文件路径 |
|------|------|----------|
| TasksPage.vue | ~1420 行 | `admin-web/src/pages/tasks/TasksPage.vue` |
| ClassesPage.vue | ~765 行 | `admin-web/src/pages/classes/ClassesPage.vue` |
| UsersPage.vue | ~515 行 | `admin-web/src/pages/users/UsersPage.vue` |
| AnnouncementsPage.vue | ~610 行 | `admin-web/src/pages/announcements/AnnouncementsPage.vue` |
| SubmissionsPage.vue | ~665 行 | `admin-web/src/pages/submissions/SubmissionsPage.vue` |

**建议：**

提取 composables（如 `useTablePagination`、`useCloudResource`、`useFormDialog`）来复用通用逻辑。

---

#### 问题 1.4：PageHeader 组件功能过于简单

**严重程度：** 低

**文件：** `admin-web/src/components/PageHeader.vue`

只有 title、description、eyebrow 和 actions 插槽，缺少面包屑 slot、返回按钮、页面级 loading 状态指示。

---

### 3.2 组件使用问题

#### 问题 2.1：大量工具函数在页面间重复定义

**严重程度：** 中

`formatDateTime` 函数在以下 9 个文件中各自独立实现，代码几乎相同：

- ConfigPage.vue
- ProjectsPage.vue
- UsersPage.vue
- ClassesPage.vue
- TasksPage.vue
- RankingsPage.vue
- LogsPage.vue
- AnnouncementsPage.vue
- SubmissionsPage.vue

`formatFileSize` 在 `TasksPage.vue` 和 `SubmissionsPage.vue` 中各有一份。

**建议：**

统一提取到 `admin-web/src/utils/format.js` 中。

---

#### 问题 2.2：状态标签映射函数大量重复

**严重程度：** 中

`getStatusLabel` / `getStatusTheme` 在 ConfigPage、ClassesPage、TasksPage、SubmissionsPage、AnnouncementsPage 中各自实现，映射逻辑大同小异。

**建议：**

提取为通用的状态映射工具。

---

#### 问题 2.3：云文件 URL 解析逻辑重复

**严重程度：** 中

`resolveResourceURLs`、`getResourceURL`/`getResourceURLSync`、`downloadResource`、`isCloudFileID`/`isWebURL` 等逻辑在 `TasksPage.vue` 和 `SubmissionsPage.vue` 中几乎完全相同。

**建议：**

提取为 `useCloudResource` composable。

---

#### 问题 2.4：StatCard 组件缺少关键能力

**严重程度：** 中

**文件：** `admin-web/src/components/StatCard.vue`

**缺少功能：**

- 无趋势指示（上升/下降箭头和百分比）
- 无颜色主题支持（如 warning/danger 用于"待审核"卡片）
- 无图标支持
- 无骨架屏加载态

**问题：**

`SubmissionsPage`、`LogsPage`、`RankingsPage` 没有使用 StatCard 组件，而是用 `t-card` 手动拼出了结构类似的统计卡片。

**建议：**

增强 StatCard 组件，让其他页面复用。

---

#### 问题 2.5：缺少全局骨架屏/空状态组件

**严重程度：** 中

所有页面的数据加载态只有表格的 `loading` 属性，DashboardPage 的统计卡片、图表区域加载时显示 `'--'`，没有骨架屏过渡。

**建议：**

使用 TDesign 的 `t-skeleton` 组件。

---

### 3.3 响应式设计问题

#### 问题 3.1：侧边栏在移动端处理不佳

**严重程度：** 高

**文件：** `admin-web/src/styles/theme.css`，第 1464-1578 行

在 `max-width: 900px` 断点下，侧边栏变成全宽并堆叠在顶部，但：

- 10 个菜单项在小屏上水平排列会溢出
- 用户每次切换页面都需要滚动过整个菜单栏

**建议：**

改为使用 `t-drawer` 组件包裹侧边栏菜单。

---

#### 问题 3.2：弹窗宽度不适配移动端

**严重程度：** 高

多个 Dialog 使用了固定宽度，在手机上会溢出屏幕：

| 页面 | Dialog | 宽度 |
|------|--------|------|
| TasksPage | 新增/编辑任务 | 860px |
| TasksPage | 任务详情 | 940px |
| RankingsPage | 历史详情 | 980px |
| ClassesPage | 班级详情 | 920px |
| SubmissionsPage | 提交详情 | 920px |
| LogsPage | 日志详情 | 820px |

**建议：**

添加响应式 CSS：

```css
@media (max-width: 900px) {
  .t-dialog { width: 95vw !important; max-width: 95vw; }
}
```

---

#### 问题 3.3：`overflow-x: hidden` 导致表格内容被裁切

**严重程度：** 中

**文件：** `theme.css` 第 88 行

```css
.admin-content {
  overflow-x: hidden;
}
```

当表格内容超出容器时，水平滚动被禁止，用户无法看到被裁切的列。

**建议：**

改为 `overflow-x: auto` 或 `clip`。

---

#### 问题 3.4：详情页摘要网格在窄屏下信息密度过高

**严重程度：** 低

`.task-detail-summary`、`.submission-detail-summary`、`.ranking-detail-summary` 等使用 `repeat(4, ...)` 布局。在 560px 断点下变为单列，但每个卡片仍包含 label + value，垂直空间占用过大。

**建议：**

在移动端将摘要改为横向紧凑列表。

---

#### 问题 3.5：DashboardPage 响应式不充分

**严重程度：** 中

**文件：** `admin-web/src/pages/dashboard/DashboardPage.vue` 第 24-48 行

```html
<t-col :span="8">...</t-col>
<t-col :span="4">...</t-col>
```

没有设置 `xs`/`sm`/`md`/`lg` 响应式断点属性，在移动端会保持 8:4 的比例，图表区域过窄。

**建议：**

添加响应式断点：

```html
<t-col :xs="12" :sm="12" :md="8" :lg="8">
```

---

#### 问题 3.6：搜索/筛选工具栏在移动端布局不够灵活

**严重程度：** 低

虽然 `theme.css` 在 900px 以下将搜索框设为 `width: 100%`，但 `config-toolbar` 使用 `flex-direction: column` 后，多个筛选器和按钮纵向堆叠会占据大量空间。

**建议：**

在移动端使用折叠面板收纳筛选条件。

---

### 3.4 用户体验问题

#### 问题 4.1：日期/时间输入使用纯文本框

**严重程度：** 高

以下表单字段使用 `t-input` 手动输入日期时间，用户容易格式错误：

- `TasksPage` 的 `deadline_date`（"YYYY-MM-DD"）和 `deadline_time`（"HH:mm"）
- `AnnouncementsPage` 的 `start_time` 和 `end_time`（"YYYY-MM-DD HH:mm"）
- `LogsPage` 的 `start_date` 和 `end_date`

**建议：**

改用 `t-date-picker` 和 `t-time-picker` 组件。

---

#### 问题 4.2：表单离开无确认保护

**严重程度：** 中

所有含表单的 Dialog 没有 dirty check。用户填写大量内容后误点取消或按 Escape 会丢失所有输入，没有二次确认。

---

#### 问题 4.3：搜索需手动点击"查询"按钮

**严重程度：** 低

ConfigPage、ProjectsPage 等页面，输入关键词后按 Enter 才触发搜索，但没有 debounce 自动搜索。

**建议：**

对搜索输入添加 300ms debounce 自动查询。

---

#### 问题 4.4：分页行为不一致

**严重程度：** 中

| 页面 | 分页方式 | pageSizeOptions |
|------|---------|----------------|
| ConfigPage | 客户端分页 | 无 |
| ProjectsPage | 客户端分页 | 无 |
| UsersPage | 服务端分页 | [10, 20, 50, 100] |
| ClassesPage | 服务端分页 | [10, 20, 50, 100] |
| TasksPage | 服务端分页 | [10, 20, 50, 100] |
| LogsPage | 服务端分页 | 无（仅 showPageSize） |

**建议：**

统一服务端分页，并为所有页面配置 `pageSizeOptions`。

---

#### 问题 4.5：DashboardPage 统计卡片过多导致视觉疲劳

**严重程度：** 中

8 个 StatCard 在一行中展示（4x2 网格），信息密度高但关键指标不突出。

**建议：**

- 将最核心的 4 个指标放在首行
- 其余指标折叠或放入"更多指标"区域
- 为"待审核"等需要关注的指标添加醒目的颜色标记

---

#### 问题 4.6：操作反馈单一

**严重程度：** 中

所有操作成功/失败只用 `MessagePlugin` 弹出轻提示，几秒后自动消失。

**建议：**

关键操作（如删除、审核）使用 `t-dialog` 确认或更持久的通知方式。

---

#### 问题 4.7：退出登录按钮缺少图标且位置不醒目

**严重程度：** 低

**文件：** `AdminLayout.vue` 第 32 行

```html
<t-button size="small" variant="outline" @click="handleLogout">退出</t-button>
```

退出操作放在 header-meta 的末尾，与环境标签和用户名混在一起。

**建议：**

使用图标按钮并放置在更显眼的位置，或放入用户下拉菜单中。

---

### 3.5 样式一致性问题

#### 问题 5.1：CSS 类名语义混乱

**严重程度：** 中

多个页面共用了名为 `.config-card`、`.config-toolbar`、`.config-search` 的 CSS 类，但这些类并非 ConfigPage 专用。

**建议：**

统一命名为 `.page-card`、`.filter-toolbar`、`.filter-search`。

---

#### 问题 5.2：统计卡片样式碎片化

**严重程度：** 中

至少存在 5 套统计卡片样式：

- `.stat-card`（DashboardPage，通过 StatCard 组件）
- `.submission-stat-card`（SubmissionsPage）
- `.log-stat-card`（LogsPage）
- `.ranking-stat-card`（RankingsPage）
- `.task-detail-summary`、`.class-detail-summary` 等详情摘要卡片

**建议：**

合并为一套通用的统计卡片样式。

---

#### 问题 5.3：大量硬编码颜色值

**严重程度：** 中

`theme.css` 定义了 CSS 变量，但许多地方直接使用硬编码：

- `#172033`（文字色）在多处直接使用
- `#334155`（描述文字色）在多处硬编码
- `#f8fbfd`（背景色）在 20+ 处硬编码
- `#102033`（代码块背景）硬编码

**建议：**

统一使用 CSS 变量，如 `var(--admin-text)`、`var(--admin-surface)` 等。

---

#### 问题 5.4：阴影值不一致

**严重程度：** 低

至少存在 3 种不同的阴影定义：

```css
box-shadow: 0 18px 50px rgba(24, 48, 76, 0.08);   /* stat-card, config-card 等 */
box-shadow: 0 28px 80px rgba(24, 48, 76, 0.14);    /* login-panel */
/* 无阴影 */                                          /* 多数详情卡片 */
```

**建议：**

定义阴影变量如 `--admin-shadow-sm`、`--admin-shadow-md`、`--admin-shadow-lg`。

---

#### 问题 5.5：圆角值不统一

**严重程度：** 低

| 元素 | 圆角值 |
|------|--------|
| 品牌标记 | `14px` |
| 详情信息卡片 | `14px` |
| 编辑器行 | `12px` |
| 图片占位 | `10px` |
| 代码块 | `8px` |
| 登录面板 | `28px` |

**建议：**

建立统一的圆角规范：`--admin-radius-sm: 8px`、`--admin-radius-md: 12px`、`--admin-radius-lg: 16px`。

---

#### 问题 5.6：缺少全局过渡/动画

**严重程度：** 低

- 侧边栏收起有 `transition: width 0.2s ease`，但其他交互没有统一的过渡定义
- 没有定义页面切换过渡效果

**建议：**

为 Dialog、表格行 hover、按钮状态变化等添加统一过渡，为 `<router-view>` 添加 `<transition>`。

---

#### 问题 5.7：缺少打印样式和滚动条美化

**严重程度：** 低

- 没有 `@media print` 样式，后台报表页面打印时会丢失布局
- 没有对 WebKit 滚动条做样式定制

**建议：**

添加打印样式和滚动条美化。

---

## 四、优化建议汇总

### 4.1 小程序端优化建议

| 优先级 | 优化项 | 影响范围 | 状态 |
|--------|--------|----------|------|
| P0 | 提取通用样式到 `common.wxss`，消除 22 个文件中的大量重复代码 | 全局 | ✅ 已解决 |
| P0 | 统一 `.container` 布局模式为 flex 纵向布局 | 全局 | ✅ 已解决 |
| P0 | 统一 `.content` 高度计算方式 | 全局 | ✅ 已解决 |
| P1 | 统一 `.hero-card` 渐变背景色值 | 全局 |
| P1 | 统一 `.summary-value` 字体大小 | 全局 |
| P1 | 统一按钮类名体系，减少碎片化 | 全局 |
| P1 | 统一 `z-index` 层级规范 | 全局 |
| P1 | 重写设置页（setting）以匹配全局设计语言 | 设置页 |
| P1 | 统一 `form` 组件的单位为 `rpx` | 组件 |
| P2 | 统一 `scroll-view` 的 `bounces` 和 `show-scrollbar` 属性 | 全局 |
| P2 | 为列表页添加下拉刷新支持 | 列表页 |
| P2 | 决定 `empty` 和 `loading` 组件的去留 | 组件 |
| P2 | 去掉教师端不必要的 `navbar-wrapper` 包裹层 | 教师端 |
| P2 | 为登录页注册流程添加滚动支持 | 登录页 |
| P2 | 将 `t-toast` 统一配置或按需引入 | 全局 |
| P3 | 教师审核弹出层操作按钮固定化 | 审核中心 |
| P3 | 学生班级管理页内容过多，考虑分 tab | 班级管理 |

---

### 4.2 后台管理端优化建议

**高优先级（影响功能或大量用户）：**

1. 路由懒加载 -- 减少首屏加载时间
2. 移动端侧边栏改为抽屉菜单 -- 影响所有移动端用户
3. Dialog 响应式适配 -- 多个详情弹窗在小屏溢出
4. 日期时间字段改用 DatePicker 组件 -- 减少用户输入错误
5. 提取重复的 `formatDateTime`、`formatFileSize`、云文件处理等为公共模块

**中优先级（改善体验和维护性）：**

6. 统一统计卡片样式，让 SubmissionsPage/LogsPage/RankingsPage 复用 StatCard
7. 拆分大页面文件为 composable + 组件
8. 添加骨架屏加载态
9. DashboardPage 图表区域添加响应式断点
10. 统一 CSS 变量，消除硬编码颜色和阴影

**低优先级（锦上添花）：**

11. 为菜单项添加图标
12. 添加面包屑导航
13. 搜索输入添加 debounce 自动查询
14. 表单 dirty check 离开确认
15. 添加页面切换过渡动画

---

## 五、优先级行动计划

### 5.1 第一阶段：架构优化（1-2周）

| 任务 | 影响范围 | 工作量 | 端 | 状态 |
|------|----------|--------|-----|------|
| 提取小程序通用样式到 common.wxss | 22个文件 | 中 | 小程序 | ✅ 已完成 |
| 统一小程序 .container 布局模式 | 全局 | 中 | 小程序 | ✅ 已完成 |
| 统一 .content 高度计算方式 | 全局 | 中 | 小程序 | ✅ 已完成 |
| 后台路由懒加载 | 首屏性能 | 小 | 后台 | 待处理 |
| 提取后台 formatDateTime 等工具函数 | 9个页面 | 小 | 后台 | 待处理 |
| Dialog 响应式适配 | 6个弹窗 | 小 | 后台 | 待处理 |

### 5.2 第二阶段：体验优化（1周）

| 任务 | 影响范围 | 工作量 | 端 |
|------|----------|--------|-----|
| 移动端侧边栏改抽屉菜单 | 后台全局 | 中 | 后台 |
| 日期字段改用 DatePicker | 3个页面 | 小 | 后台 |
| 统一 scroll-view 属性 | 小程序全局 | 小 | 小程序 |
| 重写设置页布局 | 1个页面 | 中 | 小程序 |

### 5.3 第三阶段：细节打磨（持续）

| 任务 | 影响范围 | 工作量 | 端 |
|------|----------|--------|-----|
| 统一统计卡片样式 | 后台全局 | 中 | 后台 |
| 拆分大页面为 composable | 5个页面 | 大 | 后台 |
| 添加骨架屏加载态 | 全局 | 中 | 双端 |
| 统一 CSS 变量系统 | 后台全局 | 中 | 后台 |

---

## 六、快速收益建议

如果时间有限，建议优先做这 3 件事：

### 1. 小程序 common.wxss 提取通用样式 ✅ 已完成

**收益：** 立即减少 60% 的样式重复代码
**工作量：** 中
**实际方案：**

创建 `miniprogram/styles/common.wxss`，通过 `app.wxss` 的 `@import` 引入。提取了以下通用样式：

```css
/* 容器布局 */
.container { ... }    /* 统一 flex 纵向布局 */
.header { ... }       /* 统一头部样式 */
.content { ... }      /* 统一内容区 flex: 1 */

/* 按钮系统 */
.primary-btn { ... }
.ghost-btn { ... }

/* 卡片系统 */
.hero-card { ... }
.section-card { ... }
.state-card { ... }

/* 统计网格 */
.summary-grid { ... }
.summary-item { ... }
.summary-value { ... }
.summary-label { ... }

/* 通用组件 */
.section-title { ... }
.role-tag { ... }
.empty-card { ... }
```

### 2. 后台路由懒加载

**收益：** 一行代码改善首屏性能
**工作量：** 小
**方法：**

```javascript
// 修改前
import DashboardPage from '@/pages/dashboard/DashboardPage.vue';

// 修改后
const DashboardPage = () => import('@/pages/dashboard/DashboardPage.vue');
```

### 3. Dialog 响应式适配

**收益：** 一段 CSS 解决移动端弹窗溢出
**工作量：** 小
**方法：**

在 `theme.css` 中添加：

```css
@media (max-width: 900px) {
  .t-dialog {
    width: 95vw !important;
    max-width: 95vw;
    margin: 0 auto;
  }
}
```

---

## 附录：相关文件清单

### 小程序端页面文件

| 页面 | 路径 |
|------|------|
| 学生首页 | `miniprogram/pages/student/index.*` |
| 学生我的页 | `miniprogram/pages/student/mine/mine.*` |
| 学生排行榜 | `miniprogram/pages/student/rank/rank.*` |
| 学生设置页 | `miniprogram/pages/student/setting/setting.*` |
| 学生班级管理 | `miniprogram/pages/student/class-manage/class-manage.*` |
| 学生班级详情 | `miniprogram/pages/student/class-manage/class-detail/class-detail.*` |
| 学生入班确认 | `miniprogram/pages/student/class-manage/join-confirm/join-confirm.*` |
| 学生任务管理 | `miniprogram/pages/student/task-manage/task-manage.*` |
| 学生任务详情 | `miniprogram/pages/student/task-manage/task-detail/task-detail.*` |
| 学生提交编辑 | `miniprogram/pages/student/task-manage/submission-edit/submission-edit.*` |
| 学生提交记录 | `miniprogram/pages/student/task-manage/submission-records/submission-records.*` |
| 教师首页 | `miniprogram/pages/teacher/index.*` |
| 教师我的页 | `miniprogram/pages/teacher/mine/mine.*` |
| 教师审核中心 | `miniprogram/pages/teacher/pending/pending.*` |
| 教师班级管理 | `miniprogram/pages/teacher/class-manage/class-manage.*` |
| 教师班级详情 | `miniprogram/pages/teacher/class-manage/class-detail/class-detail.*` |
| 教师班级编辑 | `miniprogram/pages/teacher/class-manage/class-edit/class-edit.*` |
| 教师任务管理 | `miniprogram/pages/teacher/task-manage/task-manage.*` |
| 教师任务详情 | `miniprogram/pages/teacher/task-manage/task-detail/task-detail.*` |
| 教师任务编辑 | `miniprogram/pages/teacher/task-manage/task-edit/task-edit.*` |
| 通知中心 | `miniprogram/pages/common/announcements/announcements.*` |
| 登录页 | `miniprogram/pages/login/login.*` |

### 小程序端组件文件

| 组件 | 路径 |
|------|------|
| 自定义导航栏 | `miniprogram/components/custom-navbar/` |
| 空状态组件 | `miniprogram/components/empty/` |
| 表单组件 | `miniprogram/components/form/` |
| 加载组件 | `miniprogram/components/loading/` |
| 公告面板组件 | `miniprogram/components/announcement-panel/` |

### 后台管理端页面文件

| 页面 | 路径 |
|------|------|
| 运营概览 | `admin-web/src/pages/dashboard/DashboardPage.vue` |
| 系统配置 | `admin-web/src/pages/config/ConfigPage.vue` |
| 项目配置 | `admin-web/src/pages/projects/ProjectsPage.vue` |
| 用户管理 | `admin-web/src/pages/users/UsersPage.vue` |
| 班级管理 | `admin-web/src/pages/classes/ClassesPage.vue` |
| 任务管理 | `admin-web/src/pages/tasks/TasksPage.vue` |
| 提交管理 | `admin-web/src/pages/submissions/SubmissionsPage.vue` |
| 排行榜 | `admin-web/src/pages/rankings/RankingsPage.vue` |
| 公告管理 | `admin-web/src/pages/announcements/AnnouncementsPage.vue` |
| 操作日志 | `admin-web/src/pages/logs/LogsPage.vue` |

### 后台管理端组件文件

| 组件 | 路径 |
|------|------|
| 管理布局 | `admin-web/src/layouts/AdminLayout.vue` |
| 页面头部 | `admin-web/src/components/PageHeader.vue` |
| 统计卡片 | `admin-web/src/components/StatCard.vue` |
| 登录页 | `admin-web/src/pages/login/LoginPage.vue` |

---

**文档结束**

如有疑问或需要进一步的优化建议，请联系开发团队。
