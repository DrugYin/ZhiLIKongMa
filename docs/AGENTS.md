# Project Instructions

This file provides context for AI assistants working on this project.

## Project Type: Node.js

### Commands
- Install: `npm install`
- Test: `npm test`
- Build: `npm run build`
- Start: `npm start`

### Version Control
This project uses Git. See .gitignore for excluded files.


## Guidelines

- Follow existing code style and patterns
- Write tests for new functionality
- Keep changes focused and atomic
- Document public APIs

## Important Notes

<!-- Add project-specific notes here -->
## 项目概述

智慧控码训练系统是一个基于微信小程序的教育培训管理平台，支持学生和教师两种角色，提供任务发布、作业提交、审核评分、积分奖励、排行榜等功能。已同步至 2026-05-14 最新代码状态。

## 项目结构

```
ZhiLiKongMa/
├── miniprogram/              # 微信小程序前端
│   ├── assets/               # 静态资源（头像等）
│   ├── components/           # 公共组件
│   ├── config/               # 配置文件
│   ├── custom-tab-bar/       # 自定义 TabBar
│   ├── pages/                # 页面目录
│   ├── services/             # 服务层
│   ├── styles/               # 全局样式
│   └── utils/                # 工具函数
├── cloudfunctions/           # 云函数后端
│   └── _shared/              # 共享模块
├── admin-web/                # 后台管理网站 (Vue 3)
│   └── src/                  # 源码目录
└── copyright-application-materials/  # 版权申请材料
```

## 技术栈

### 小程序端
- 微信小程序基础库 3.0+
- JavaScript ES6+
- TDesign Mini 1.x (UI 组件库)
- Skyline 渲染引擎
- CloudBase 云开发

### 后台管理端
- Vue 3 + Vite
- TDesign Vue Next
- Pinia 状态管理
- Vue Router Hash 模式
- ECharts 图表
- CloudBase Web SDK

### 后端
- CloudBase 云函数
- CloudBase 文档数据库
- wx-server-sdk

## 常用命令

### 小程序开发
```bash
# 使用微信开发者工具打开项目
# 项目根目录: D:\Barbuda\Project\ZhiLiKongMa
# 小程序目录: miniprogram/

# 安装依赖
cd miniprogram
npm install

# 构建 npm (在微信开发者工具中)
# 工具 -> 构建 npm
```

### 后台管理端开发
```bash
cd admin-web

# 安装依赖
npm install

# 本地开发
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

### 环境变量配置
后台管理端需要配置环境变量:
```bash
cp admin-web/.env.example admin-web/.env.local
```

编辑 `.env.local` 文件:
```
VITE_CLOUDBASE_ENV_ID=zhi-li-kong-ma-7gy2aqcr1add21a7
VITE_CLOUDBASE_REGION=ap-shanghai
VITE_CLOUDBASE_ACCESS_KEY=你的 Web 访问密钥
```

## 代码架构

### 小程序页面结构
```
pages/
├── login/                    # 登录页
├── student/                  # 学生端
│   ├── index.js              # 学生首页
│   ├── class-manage/         # 班级管理
│   ├── task-manage/          # 任务中心
│   ├── rank/                 # 排行榜
│   ├── points-log/           # 积分明细
│   ├── mine/                 # 我的
│   └── setting/              # 设置
├── teacher/                  # 教师端
│   ├── index.js              # 教师首页
│   ├── class-manage/         # 班级管理
│   ├── task-manage/          # 任务管理
│   ├── pending/              # 审核页面
│   └── mine/                 # 我的
└── common/                   # 公共页面
    └── announcements/        # 通知中心
```

### 服务层架构
```
miniprogram/services/
├── api.js           # 云函数调用封装
├── auth.js          # 认证服务
├── class.js         # 班级服务
├── task.js          # 任务服务
├── ranking.js       # 排行榜服务
├── storage.js       # 存储服务
└── announcement.js  # 公告服务
```

### 云函数结构
```
cloudfunctions/
├── _shared/                   # 共享模块
│   ├── auth.js                # 认证工具
│   ├── response.js            # 响应格式
│   ├── membership.js          # 成员管理
│   ├── task-access.js         # 任务权限
│   ├── operation-log.js       # 操作日志
│   ├── points-log.js          # 积分记录
│   ├── admin-operation-log.js # 管理员操作日志
│   └── notification.js        # 通知服务
├── login/                     # 用户登录
├── register/                  # 用户注册
├── get-user-info/             # 获取用户信息
├── get-user-roles/            # 获取用户角色
├── switch-role/               # 切换角色
├── update-user/               # 更新用户信息
├── create-class/              # 创建班级
├── update-class/              # 更新班级
├── delete-class/              # 删除班级
├── get-classes/               # 获取班级列表
├── get-class-detail/          # 获取班级详情
├── get-class-invite-info/     # 获取班级邀请信息
├── get-my-class-status/       # 获取学生班级状态
├── join-class/                # 加入班级
├── get-class-applications/    # 获取入班申请
├── handle-join-application/   # 处理入班申请
├── get-class-members/         # 获取班级成员
├── remove-member/             # 移除成员
├── get-projects/              # 获取项目列表
├── get-points-log/            # 获取积分明细
├── get-announcements/         # 获取公告
├── create-task/               # 创建任务
├── update-task/               # 更新任务
├── delete-task/               # 删除任务
├── get-tasks/                 # 获取任务列表
├── get-task-detail/           # 获取任务详情
├── submit-task/               # 提交任务
├── get-submissions/           # 获取提交记录
├── review-submission/         # 审核提交
├── get-ranking/               # 获取排行榜
├── refresh-ranking-snapshots/ # 刷新排行榜快照
└── admin-*/                   # 管理后台云函数
```

### 后台管理端结构
```
admin-web/src/
├── api/                # API 接口
├── components/         # 公共组件
├── layouts/            # 布局组件
├── pages/              # 页面（12个：运营概览、系统配置、项目配置、用户管理、班级管理、任务管理、提交记录、排行榜、公告管理、积分明细、操作日志、登录）
├── router/             # 路由配置
├── stores/             # Pinia 状态管理
├── styles/             # 样式文件
└── utils/              # 工具函数
```

## 小程序公共组件

```
miniprogram/components/
├── announcement-panel/  # 公告面板
├── back-top/            # 返回顶部
├── custom-navbar/       # 自定义导航栏
├── empty/               # 空状态组件
├── form/                # 表单组件
└── loading/             # 加载组件
```

## 小程序工具函数

```
miniprogram/utils/
├── constant.js          # 常量定义
├── file-resource.js     # 文件资源处理
├── format.js            # 格式化工具
├── task-deadline.js     # 任务截止时间处理
├── toast.js             # Toast 工具
├── util.js              # 通用工具
└── validate.js          # 验证工具
```

## 数据库集合

主要数据集合:
- `users` - 用户信息
- `classes` - 班级信息
- `class_memberships` - 班级成员关系
- `class_join_applications` - 入班申请记录
- `tasks` - 任务信息
- `submissions` - 提交记录
- `rankings` - 排行榜（已废弃，改用 ranking_snapshots）
- `ranking_snapshots` - 排行榜快照
- `announcements` - 公告
- `announcement_reads` - 公告已读记录
- `projects` - 训练项目
- `points_log` - 积分变动明细
- `system_config` - 系统配置
- `operation_logs` - 操作日志

## 开发规范

### 版本控制

- 在新增功能或修复bug时创建对应的分支
- 在验证完代码正确性后询问我是否进行合并操作
- 提交信息使用符合规范的简体中文内容

### 代码风格
- 使用 ESLint 进行代码检查
- 小程序端使用 ES6+ 语法
- 后台管理端使用 Vue 3 Composition API

### 命名规范
- 页面文件: 小写短横线分隔 (如: `task-detail`)
- 组件文件: 小写短横线分隔 (如: `custom-navbar`)
- 云函数: 小写短横线分隔 (如: `get-task-detail`)
- 变量名: 驼峰命名 (如: `userName`)
- 常量: 大写下划线分隔 (如: `MAX_RETRY_COUNT`)

### 云函数调用约定
- 小程序端通过 `wx.cloud.callFunction` 调用
- 后台管理端通过 `@cloudbase/js-sdk` 调用
- 所有写操作必须通过云函数，前端不直接修改数据库
- 管理后台云函数必须校验管理员权限

### 权限控制
- 用户角色: `student`, `teacher`, `admin`
- 管理员权限字段: `admin_role`, `admin_status`, `admin_permissions`
- 配置变更必须写入 `operation_logs`

## 部署

### 小程序部署
使用微信开发者工具上传代码，提交审核后发布。

### 后台管理端部署
构建后部署到 CloudBase 静态网站托管:
```bash
cd admin-web
npm run build
# 将 dist/ 目录部署到 CloudBase 静态网站托管的 /admin/ 子目录
```

## 注意事项

1. 云开发环境 ID: `zhi-li-kong-ma-7gy2aqcr1add21a7`
2. 云开发区域: `ap-shanghai`
3. 后台管理端使用 Hash 路由模式
4. 小程序使用 Skyline 渲染引擎，需要基础库 3.0+
5. 云函数共享模块位于 `cloudfunctions/_shared/`
