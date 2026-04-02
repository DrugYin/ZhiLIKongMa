# 智慧控码训练系统 - 开发文档

## 目录
- [1. 项目概述](#1-项目概述)
- [2. 技术栈选型](#2-技术栈选型)
- [3. 项目结构规范](#3-项目结构规范)
- [4. 命名规范](#4-命名规范)
- [5. 版本控制规范](#5-版本控制规范)
- [6. 数据库设计](#6-数据库设计)
- [7. 云函数接口设计](#7-云函数接口设计)
- [8. 页面设计](#8-页面设计)
- [9. 配置管理系统](#9-配置管理系统)
- [10. 安全设计](#10-安全设计)
- [11. 性能优化策略](#11-性能优化策略)
- [12. 开发流程](#12-开发流程)

---

## 1. 项目概述

### 1.1 项目简介
智慧控码训练系统是一个基于微信小程序的教育培训管理平台，支持学生和教师两种角色，提供任务发布、作业提交、审核评分、积分奖励、排行榜等功能。

### 1.2 核心功能模块

| 模块 | 功能描述 | 开发状态 |
|------|----------|----------|
| 用户系统 | 学生注册/登录、教师账号登录、微信授权登录 | ✅ 已完成 |
| 项目系统 | 训练项目配置（编程、无人机、机器人） | ✅ 已完成 |
| 班级系统 | 创建班级、加入班级、班级成员管理 | ⬜ 待开发 |
| 任务系统 | 发布任务（mission）、任务分类、截止时间、积分设置 | ⬜ 待开发 |
| 提交系统 | 学生提交作业、图片/文件上传、提交记录 | ⬜ 待开发 |
| 审核系统 | 教师审核批改、评分、反馈 | ⬜ 待开发 |
| 积分系统 | 积分累计、积分消费、积分排行 | ⬜ 待开发 |
| 抽奖系统 | 积分抽奖、奖品管理 | ⬜ 待开发 |
| 排行榜 | 学生积分排行、任务完成排行 | ⬜ 待开发 |
| 配置系统 | 后台参数配置、系统设置 | ⬜ 待开发 |

### 1.3 用户角色

```
┌─────────────────────────────────────────────────────────┐
│                      用户角色                            │
├─────────────────────┬───────────────────────────────────┤
│      学生 (Student)  │           教师 (Teacher)          │
├─────────────────────┼───────────────────────────────────┤
│ • 微信登录           │ • 账号密码登录                     │
│ • 注册完善信息       │ • 微信授权登录                     │
│ • 加入班级           │ • 创建/管理班级                    │
│ • 查看任务           │ • 发布/编辑任务                    │
│ • 提交作业           │ • 审核学生提交                     │
│ • 查看成绩           │ • 管理学生                         │
│ • 查看排行榜         │ • 查看统计数据                     │
│ • 参与抽奖           │ • 系统配置管理                     │
└─────────────────────┴───────────────────────────────────┘
```

---

## 2. 技术栈选型

### 2.1 前端技术

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| 微信小程序 | 基础库 3.0+ | 应用框架 | ✅ |
| JavaScript | ES6+ | 开发语言 | ✅ |
| WXSS | - | 样式语言 | ✅ |
| TDesign Mini | 1.x | UI 组件库 | ✅ |
| Skyline | - | 渲染引擎 | ✅ |

### 2.2 后端技术

| 技术 | 版本 | 用途 | 状态 |
|------|------|------|------|
| 微信云开发 | - | 云函数/数据库/存储 | ✅ |
| CloudBase | - | 云开发环境 | ✅ |
| wx-server-sdk | 最新 | 云开发 SDK | ✅ |

### 2.3 开发工具

| 工具 | 用途 |
|------|------|
| VS Code | 代码编辑器 |
| 微信开发者工具 | 小程序调试 |
| Git | 版本控制 |
| ESLint | 代码检查 |

---

## 3. 项目结构规范

### 3.1 当前目录结构

```
ZhiLiKongMa/
├── assets/                     # 静态资源
│   └── default-avatar.png     # 默认头像
│
├── cloudfunctions/             # 云函数目录
│   ├── get-user-info/         # 获取用户信息
│   ├── get-user-roles/        # 获取用户角色
│   ├── login/                 # 用户登录
│   ├── register/              # 用户注册
│   ├── switch-role/           # 切换角色
│   └── update-user/           # 更新用户信息
│
├── components/                 # 公共组件
│   ├── custom-navbar/         # 自定义导航栏
│   ├── empty/                 # 空状态组件
│   ├── form/                  # 表单组件
│   └── loading/               # 加载组件
│
├── config/                     # 配置文件
│   └── project.js             # 项目配置服务
│
├── custom-tab-bar/             # 自定义 TabBar
│   ├── index.js
│   ├── index.json
│   ├── index.wxml
│   └── index.wxss
│
├── miniprogram_npm/            # NPM 构建产物
│
├── pages/                      # 页面目录
│   ├── login/                 # 登录页
│   │   ├── login.js
│   │   ├── login.json
│   │   ├── login.wxml
│   │   └── login.wxss
│   │
│   ├── student/               # 学生端页面
│   │   ├── index.js           # 学生首页
│   │   ├── index.json
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   ├── mine/              # 我的页面
│   │   ├── rank/              # 排行榜
│   │   ├── setting/           # 设置页面
│   │   └── training/          # 训练页面
│   │
│   └── teacher/               # 教师端页面
│       ├── index.js           # 教师首页
│       ├── index.json
│       ├── index.wxml
│       ├── index.wxss
│       ├── class-manage/      # 班级管理
│       │   ├── class-manage.js
│       │   ├── class-manage.json
│       │   ├── class-manage.wxml
│       │   ├── class-manage.wxss
│       │   └── class-detail/  # 班级详情
│       ├── task-manage/       # 任务管理
│       │   ├── task-manage.js
│       │   ├── task-manage.json
│       │   ├── task-manage.wxml
│       │   ├── task-manage.wxss
│       │   ├── task-detail/   # 任务详情
│       │   └── task-edit/     # 任务编辑
│       ├── mine/              # 我的页面
│       └── pending/           # 审核页面
│
├── services/                   # 服务层
│   ├── api.js                 # API 统一调用
│   ├── auth.js                # 认证服务
│   └── storage.js             # 存储服务
│
├── utils/                      # 工具函数
│   ├── constant.js            # 常量定义
│   ├── format.js              # 格式化工具
│   ├── toast.js               # Toast 工具
│   ├── util.js                # 通用工具
│   └── validate.js            # 验证工具
│
├── .eslintrc.js               # ESLint 配置
├── .gitignore                 # Git 忽略文件
├── app.js                     # 应用入口
├── app.json                   # 全局配置
├── app.wxss                   # 全局样式
├── package.json               # 项目依赖
├── project.config.json        # 小程序项目配置
└── sitemap.json               # 站点地图
```

### 3.2 文件命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 页面文件 | 小写 + 连字符 | `class-manage/`, `task-detail/` |
| 组件文件 | 小写 + 连字符 | `custom-navbar/`, `loading/` |
| 云函数 | 小写 + 连字符 | `login/`, `register/`, `get-user-info/` |
| 工具文件 | 小写 + 连字符 | `format.js`, `validate.js` |
| 常量文件 | 小写 + 连字符 | `constant.js` |

### 3.3 代码文件结构

每个页面包含以下文件：
```
page-name/
├── index.js        # 逻辑文件
├── index.wxml      # 模板文件
├── index.wxss      # 样式文件
└── index.json      # 配置文件
```

---

## 4. 命名规范

### 4.1 变量命名

```javascript
// ✅ 正确
const userName = '张三';
const isLoggedIn = true;
const taskList = [];
const MAX_RETRY_COUNT = 3;

// ❌ 错误
const user_name = '张三';
const islogin = true;
const tasklist = [];
```

| 类型 | 规范 | 示例 |
|------|------|------|
| 普通变量 | 驼峰命名 | `userName`, `taskList` |
| 布尔变量 | is/has/can 前缀 | `isLoading`, `hasPermission` |
| 常量 | 全大写 + 下划线 | `MAX_COUNT`, `API_BASE_URL` |
| 私有变量 | 下划线前缀 | `_cache`, `_timer` |

### 4.2 函数命名

```javascript
// ✅ 正确
function getUserInfo() { }
function handleSubmit() { }
function validateForm() { }

// ❌ 错误
function getuserinfo() { }
function onsubmit() { }
```

| 类型 | 规范 | 示例 |
|------|------|------|
| 普通函数 | 驼峰命名 | `getUserInfo`, `formatDate` |
| 事件处理 | handle 前缀 | `handleSubmit`, `handleClick` |
| 生命周期函数 | on 前缀 | `onLoad`, `onShow` |
| 异步函数 | 动词原形 | `fetchData`, `submitForm` |

### 4.3 云函数命名

```javascript
// ✅ 正确：动词 + 名词
'login'
'register'
'get-user-info'
'update-user'
'switch-role'

// ❌ 错误
'getUserInfo'      // 不用驼峰
'userInfo'         // 缺少动词
```

### 4.4 数据库字段命名

```javascript
// ✅ 正确：使用下划线命名
{
  _id: 'xxx',
  _openid: 'xxx',
  user_name: '张三',
  create_time: new Date(),
  update_time: new Date(),
  is_deleted: false
}

// ❌ 错误
{
  userName: '张三',      // 不用驼峰
  createTime: new Date()  // 不用驼峰
}
```

### 4.5 API 接口命名

```
// RESTful 风格
POST   /login              // 用户登录
POST   /register           // 用户注册
POST   /update-user        // 更新用户
POST   /get-user-info      // 获取用户信息
POST   /switch-role        // 切换角色
```

---

## 5. 版本控制规范

### 5.1 Git 分支策略

```
main            # 生产环境分支（稳定版本）
├── develop     # 开发主分支
│   ├── feature/user-auth    # 功能分支
│   ├── feature/task-system  # 功能分支
│   └── feature/lottery      # 功能分支
├── release/1.0.0            # 发布分支
└── hotfix/login-bug         # 热修复分支
```

### 5.2 分支命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能分支 | `feature/功能名` | `feature/user-login` |
| 修复分支 | `fix/问题描述` | `fix/login-error` |
| 热修复 | `hotfix/问题描述` | `hotfix/security-fix` |
| 发布分支 | `release/版本号` | `release/1.0.0` |

### 5.3 Commit 规范

```bash
# 格式
<type>(<scope>): <subject>

# 示例
feat(user): 添加用户注册功能
fix(task): 修复任务列表查询bug
docs(readme): 更新README文档
style(login): 调整登录页面样式
refactor(api): 重构云函数调用逻辑
test(unit): 添加用户模块单元测试
chore(deps): 更新依赖版本
```

| Type | 说明 |
|------|------|
| feat | 新功能 |
| fix | 修复 bug |
| docs | 文档更新 |
| style | 代码格式（不影响功能） |
| refactor | 重构 |
| test | 测试相关 |
| chore | 构建/工具链相关 |

---

## 6. 数据库设计

### 6.1 数据库集合总览

```
┌─────────────────────────────────────────────────────────────┐
│                      数据库集合                               │
├───────────────┬─────────────────────────────────────────────┤
│    用户相关    │  users（统一用户表，含学生和教师）             │
├───────────────┼─────────────────────────────────────────────┤
│    项目相关    │  projects（训练项目配置表）                   │
├───────────────┼─────────────────────────────────────────────┤
│    班级相关    │  classes, class_members, join_applications  │
├───────────────┼─────────────────────────────────────────────┤
│    任务相关    │  missions, submissions                      │
├───────────────┼─────────────────────────────────────────────┤
│    奖品相关    │  prizes, draw_records                       │
├───────────────┼─────────────────────────────────────────────┤
│    系统相关    │  system_config, operation_logs              │
└───────────────┴─────────────────────────────────────────────┘
```

### 6.2 集合详细设计

#### 6.2.1 users（统一用户表）

> 设计说明：使用统一的 users 表存储所有用户信息，通过 roles 数组字段控制用户角色，通过 current_role 字段标识当前选中的角色视图。同一用户可以同时拥有学生和教师角色。

```javascript
{
  _id: "auto",                        // 系统自动生成
  _openid: "auto",                    // 微信 openid（系统自动）

  // ========== 基本信息 ==========
  user_name: "张三",                  // 真实姓名
  nick_name: "",                      // 昵称
  avatar_url: "cloud://xxx",          // 头像地址
  phone: "13800138000",               // 手机号

  // ========== 角色与权限 ==========
  roles: ["student", "teacher"],      // 用户拥有的角色列表
  current_role: "student",            // 当前选中的角色: student | teacher

  // ========== 学生信息（role 包含 student 时填写）==========
  school: "某某小学",                 // 学校
  grade: "三年级",                    // 年级
  birthday: "2015-01-01",             // 生日
  address: "北京市朝阳区",            // 地址

  // ========== 教师信息（role 包含 teacher 时填写）==========
  teacher_project: "编程",            // 教授项目
  teacher_project_code: "programming", // 项目编码

  // ========== 积分信息（学生角色使用）==========
  points: 50,                         // 当前积分
  total_points: 50,                   // 累计积分

  // ========== 状态信息 ==========
  status: "active",                   // 账号状态: active/disabled
  is_registered: true,                // 是否完成注册

  // ========== 时间戳 ==========
  create_time: Date,                  // 创建时间
  update_time: Date                   // 更新时间
}

// 索引配置
- _openid (唯一)
- phone (唯一，可选)
- roles
- current_role
- status
- create_time
```

#### 6.2.2 projects（训练项目配置表）

> 设计说明：将训练项目（编程、无人机、机器人等）作为可配置的数据表管理，支持动态添加新项目类型，无需修改代码。

```javascript
{
  _id: "auto",                        // 系统自动生成
  project_name: "无人机",              // 项目名称
  project_code: "drone",              // 项目编码（唯一，用于标识）
  description: "无人机操控与编程训练",  // 项目描述
  cover_image: "cloud://xxx",         // 封面图片
  icon: "cloud://xxx",                // 项目图标

  // 项目配置
  difficulty_levels: [                // 难度等级配置
    { level: 1, name: "入门", color: "#52c41a" },
    { level: 2, name: "基础", color: "#1890ff" },
    { level: 3, name: "进阶", color: "#faad14" },
    { level: 4, name: "高级", color: "#ff4d4f" },
    { level: 5, name: "专家", color: "#722ed1" }
  ],
  task_categories: [                  // 任务分类配置
    "基础训练", "综合练习", "项目实战", "竞赛模拟"
  ],

  // 积分配置
  default_points: 10,                 // 默认任务积分
  bonus_multiplier: 1.0,             // 积分倍率

  // 排序与状态
  sort_order: 1,                      // 排序序号
  status: "active",                   // 状态: active/disabled
  is_default: true,                   // 是否为默认项目

  // 统计信息
  task_count: 0,                      // 任务数量
  student_count: 0,                   // 学生数量

  // 时间戳
  create_time: Date,
  update_time: Date
}

// 索引配置
- project_code (唯一)
- status
- sort_order
- create_time

// 默认数据（通过 config/project.js 配置）
[
  { project_name: "编程", project_code: "programming", sort_order: 1 },
  { project_name: "无人机", project_code: "drone", sort_order: 2 },
  { project_name: "机器人", project_code: "robot", sort_order: 3 }
]
```

#### 6.2.3 classes（班级表）

```javascript
{
  _id: "auto",
  class_name: "编程基础一班",      // 班级名称
  class_code: "CLS001",           // 班级邀请码
  description: "适合零基础学员",   // 班级描述
  cover_image: "cloud://xxx",     // 封面图片
  teacher_id: "xxx",              // 创建教师ID
  teacher_openid: "xxx",          // 教师openid
  project_id: "xxx",              // 所属项目ID（关联 projects 表）
  max_members: 50,                // 最大成员数
  member_count: 0,                // 当前成员数
  class_time: "每周六 14:00-16:00", // 上课时间
  location: "3号楼201教室",       // 上课地点
  status: "active",               // 状态: active/archived
  create_time: Date,
  update_time: Date,
  is_deleted: false
}

// 索引
- class_code (唯一)
- teacher_openid
- teacher_id
- status
- create_time
```

#### 6.2.4 class_members（班级成员表）

```javascript
{
  _id: "auto",
  class_id: "xxx",                // 班级ID
  student_openid: "xxx",          // 学生openid
  student_id: "xxx",              // 学生ID
  join_time: Date,                // 加入时间
  role: "member",                 // 角色: member/admin
  status: "active",               // 状态: active/removed
  total_points: 0,                // 班级内累计积分
  completed_tasks: 0,             // 完成任务数
  create_time: Date,
  update_time: Date
}

// 索引
- class_id + student_openid (联合唯一)
- class_id
- student_openid
- status
```

#### 6.2.5 join_applications（加入申请表）

```javascript
{
  _id: "auto",
  class_id: "xxx",                // 班级ID
  student_openid: "xxx",          // 学生openid
  student_name: "张三",           // 学生姓名
  student_avatar: "cloud://xxx",  // 学生头像
  apply_reason: "想学习编程",      // 申请理由
  status: "pending",              // 状态: pending/approved/rejected
  handle_time: Date,              // 处理时间
  handle_by: "xxx",               // 处理人
  create_time: Date,
  update_time: Date
}

// 索引
- class_id + student_openid (联合唯一)
- class_id
- status
- create_time
```

#### 6.2.6 missions（任务表）

> 注：项目中使用 "mission" 代替 "task" 作为任务表名

```javascript
{
  _id: "auto",
  title: "无人机基础飞行训练",      // 任务标题
  description: "完成基础悬停训练",   // 任务描述
  cover_image: "cloud://xxx",     // 封面图片
  images: ["cloud://xxx"],        // 图片列表
  files: [{                       // 附件列表
    file_id: "cloud://xxx",
    file_name: "任务说明.pdf",
    file_size: 1024000
  }],
  project_id: "xxx",              // 所属项目ID（关联 projects 表）
  project_name: "无人机",         // 项目名称（冗余）
  category: "基础训练",           // 任务分类
  difficulty: 2,                  // 难度: 1-5
  points: 10,                     // 完成奖励积分
  deadline_date: "2024-12-31",    // 截止日期
  deadline_time: "23:59",         // 截止时间
  deadline: Date,                 // 截止时间（完整）
  class_id: "xxx",                // 指定班级（可选）
  class_name: "编程一班",         // 班级名称（冗余）
  teacher_id: "xxx",              // 发布教师ID
  teacher_name: "李老师",         // 教师姓名（冗余）
  teacher_openid: "xxx",          // 教师openid
  require_images: true,           // 是否需要图片
  require_description: true,      // 是否需要描述
  max_submissions: 1,             // 最大提交次数
  status: "published",            // 状态: draft/published/completed/cancelled
  publish_time: Date,             // 发布时间
  create_time: Date,
  update_time: Date,
  is_deleted: false
}

// 索引
- teacher_id
- class_id
- project_id
- status
- deadline
- create_time
```

#### 6.2.7 submissions（提交记录表）

```javascript
{
  _id: "auto",
  task_id: "xxx",                 // 任务ID
  task_title: "任务标题",         // 任务标题（冗余）
  project_id: "xxx",              // 项目ID（关联 projects 表）
  project_name: "无人机",         // 项目名称（冗余）
  student_openid: "xxx",          // 学生openid
  student_name: "张三",           // 学生姓名（冗余）
  class_id: "xxx",                // 班级ID
  teacher_id: "xxx",              // 教师ID
  description: "我完成了悬停训练", // 提交描述
  images: ["cloud://xxx"],        // 提交图片
  files: [{                       // 提交文件
    file_id: "cloud://xxx",
    file_name: "训练视频.mp4"
  }],
  status: "pending",              // 状态: pending/approved/rejected
  score: null,                    // 评分（可选）
  feedback: "做得很好！",         // 教师反馈
  feedback_images: [],            // 反馈图片
  feedback_files: [],             // 反馈文件
  is_overtime: false,             // 是否超时提交
  points_earned: 0,               // 获得积分
  submit_time: Date,              // 提交时间
  review_time: Date,              // 审核时间
  create_time: Date,
  update_time: Date
}

// 索引
- task_id
- project_id
- student_openid
- class_id
- teacher_id
- status
- submit_time
- create_time
```

#### 6.2.8 prizes（奖品表）

```javascript
{
  _id: "auto",
  name: "精美笔记本",             // 奖品名称
  description: "限量版笔记本",     // 奖品描述
  image: "cloud://xxx",           // 奖品图片
  type: "physical",               // 类型: physical/virtual/points
  stock: 100,                     // 库存数量
  probability: 0.1,               // 中奖概率 (0-1)
  weight: 10,                     // 权重（用于抽奖计算）
  value: 50,                      // 奖品价值（积分）
  status: "active",               // 状态: active/disabled
  sort_order: 0,                  // 排序
  create_time: Date,
  update_time: Date,
  is_deleted: false
}

// 索引
- status
- sort_order
- create_time
```

#### 6.2.9 draw_records（抽奖记录表）

```javascript
{
  _id: "auto",
  student_openid: "xxx",          // 学生openid
  student_name: "张三",           // 学生姓名
  prize_id: "xxx",                // 奖品ID
  prize_name: "精美笔记本",       // 奖品名称
  prize_image: "cloud://xxx",     // 奖品图片
  points_cost: 10,                // 消耗积分
  status: "drawn",                // 状态: drawn/claimed/expired
  claim_time: Date,               // 领取时间
  create_time: Date,
  update_time: Date
}

// 索引
- student_openid
- prize_id
- status
- create_time
```

#### 6.2.10 system_config（系统配置表）

```javascript
{
  _id: "auto",
  config_key: "draw_cost_points",  // 配置键
  config_value: 10,                // 配置值
  value_type: "number",            // 值类型: string/number/boolean/json
  description: "抽奖消耗积分",      // 描述
  category: "lottery",             // 分类
  is_public: true,                 // 是否公开（前端可读）
  update_by: "xxx",                // 最后更新人
  create_time: Date,
  update_time: Date
}

// 索引
- config_key (唯一)
- category
- is_public
```

#### 6.2.11 operation_logs（操作日志表）

```javascript
{
  _id: "auto",
  user_openid: "xxx",             // 操作用户
  user_type: "student",           // 用户类型
  action: "submit_task",          // 操作类型
  target_type: "submission",      // 目标类型
  target_id: "xxx",               // 目标ID
  detail: {                       // 操作详情
    task_id: "xxx",
    task_title: "xxx"
  },
  ip_address: "xxx",              // IP地址
  create_time: Date
}

// 索引
- user_openid
- action
- target_type
- create_time
```

---

## 7. 云函数接口设计

### 7.1 已实现的云函数

| 云函数 | 功能描述 | 状态 |
|--------|----------|------|
| login | 用户登录（获取openid） | ✅ 已完成 |
| register | 用户注册 | ✅ 已完成 |
| get-user-info | 获取用户信息 | ✅ 已完成 |
| get-user-roles | 获取用户角色 | ✅ 已完成 |
| switch-role | 切换用户角色 | ✅ 已完成 |
| update-user | 更新用户信息 | ✅ 已完成 |

### 7.2 待实现的云函数

| 云函数 | 功能描述 | 优先级 | 状态 |
|--------|----------|--------|------|
| create-class | 创建班级 | P0 | ⬜ 待开发 |
| get-classes | 获取班级列表 | P0 | ⬜ 待开发 |
| get-class-detail | 获取班级详情 | P0 | ⬜ 待开发 |
| join-class | 申请加入班级 | P0 | ⬜ 待开发 |
| handle-join-application | 处理申请 | P0 | ⬜ 待开发 |
| get-class-members | 获取班级成员 | P1 | ⬜ 待开发 |
| remove-member | 移除成员 | P1 | ⬜ 待开发 |
| create-task | 创建任务 | P0 | ⬜ 待开发 |
| get-tasks | 获取任务列表 | P0 | ⬜ 待开发 |
| get-task-detail | 获取任务详情 | P0 | ⬜ 待开发 |
| update-task | 更新任务 | P1 | ⬜ 待开发 |
| delete-task | 删除任务 | P1 | ⬜ 待开发 |
| submit-task | 提交任务 | P0 | ⬜ 待开发 |
| get-submissions | 获取提交列表 | P0 | ⬜ 待开发 |
| get-submission-detail | 获取提交详情 | P0 | ⬜ 待开发 |
| review-submission | 审核提交 | P0 | ⬜ 待开发 |
| start-draw | 开始抽奖 | P0 | ⬜ 待开发 |
| get-prizes | 获取奖品列表 | P0 | ⬜ 待开发 |
| get-draw-records | 获取抽奖记录 | P1 | ⬜ 待开发 |
| get-ranking | 获取排行榜 | P0 | ⬜ 待开发 |
| get-class-ranking | 班级排行榜 | P1 | ⬜ 待开发 |
| get-statistics | 获取统计数据 | P1 | ⬜ 待开发 |
| get-config | 获取系统配置 | P0 | ✅ 已完成 |
| update-config | 更新配置 | P0 | ⬜ 待开发 |
| get-projects | 获取项目列表 | P0 | ✅ 已完成 |
| create-project | 创建项目 | P1 | ⬜ 待开发 |
| update-project | 更新项目 | P1 | ⬜ 待开发 |

### 7.3 已实现云函数详细设计

#### 7.3.1 login - 用户登录

```javascript
// 云函数: login
// 功能: 用户登录（获取 openid）

// 请求参数
{
  // 无需参数，自动获取 openid
}

// 响应数据
{
  code: 200,
  success: true,
  message: '登录成功',
  data: {
    openid: string;
  }
}
```

#### 7.3.2 register - 用户注册

```javascript
// 云函数: register
// 功能: 注册新用户

// 请求参数
{
  user_name: string;       // 真实姓名（必填）
  nick_name?: string;      // 昵称
  avatar_url?: string;     // 头像地址
  phone: string;           // 手机号（必填）
  school?: string;         // 学校
  grade?: string;          // 年级
  birthday?: string;       // 生日
  address?: string;        // 地址
}

// 响应数据
{
  success: boolean;
  message: string;
  data?: {
    _id: string;
    user_name: string;
    avatar_url: string;
    roles: string[];
    current_role: string;
    points: number;
  };
  error_code?: number;
}

// 错误码
- 400: 参数不完整
- 409: 用户已注册
- 500: 注册失败
```

---

## 8. 页面设计

### 8.1 页面结构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用页面结构                              │
├─────────────────────────────────────────────────────────────────┤
│  公共页面                                                        │
│  └── 登录页 (login)                                              │
├─────────────────────────────────────────────────────────────────┤
│  学生端 (自定义 TabBar)                                          │
│  ├── 首页 (student/index)                                        │
│  │   ├── 任务列表                                                │
│  │   └── 快捷入口                                                │
│  ├── 排行榜 (student/rank)                                       │
│  ├── 训练记录 (student/training)                                 │
│  ├── 设置 (student/setting)                                      │
│  └── 我的 (student/mine)                                         │
│      └── 个人信息                                                │
├─────────────────────────────────────────────────────────────────┤
│  教师端 (自定义 TabBar)                                          │
│  ├── 首页 (teacher/index)                                        │
│  ├── 审核 (teacher/pending)                                      │
│  ├── 班级管理 (teacher/class-manage)                             │
│  │   └── 班级详情 (class-detail)                                 │
│  ├── 任务管理 (teacher/task-manage)                              │
│  │   ├── 任务详情 (task-detail)                                  │
│  │   └── 任务编辑 (task-edit)                                    │
│  └── 我的 (teacher/mine)                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 自定义 TabBar 设计

```javascript
// 学生端 TabBar
const STUDENT_TABBAR = [
  {
    value: '/pages/student/index',
    icon: 'home',
    label: '首页'
  },
  {
    value: '/pages/student/rank/rank',
    icon: 'leaderboard',
    label: '排行'
  },
  {
    value: '/pages/student/mine/mine',
    icon: 'user',
    label: '我的'
  }
];

// 教师端 TabBar
const TEACHER_TABBAR = [
  {
    value: '/pages/teacher/index',
    icon: 'home',
    label: '首页'
  },
  {
    value: '/pages/teacher/pending/pending',
    icon: 'pen-ball',
    label: '审核'
  },
  {
    value: '/pages/teacher/class-manage/class-manage',
    icon: 'work',
    label: '班级'
  },
  {
    value: '/pages/teacher/mine/mine',
    icon: 'user',
    label: '我的'
  }
];
```

### 8.3 页面路由

```json
{
  "pages": [
    "pages/student/index",
    "pages/student/mine/mine",
    "pages/login/login",
    "pages/teacher/index",
    "pages/student/setting/setting",
    "pages/student/training/training",
    "pages/student/rank/rank",
    "pages/teacher/pending/pending",
    "pages/teacher/class-manage/class-manage",
    "pages/teacher/class-manage/class-detail/class-detail",
    "pages/teacher/task-manage/task-manage",
    "pages/teacher/task-manage/task-detail/task-detail",
    "pages/teacher/task-manage/task-edit/task-edit",
    "pages/teacher/mine/mine"
  ],
  "tabBar": {
    "custom": true,
    "list": [
      {
        "pagePath": "pages/student/index",
        "text": "首页"
      },
      {
        "pagePath": "pages/student/rank/rank",
        "text": "排行榜"
      },
      {
        "pagePath": "pages/student/mine/mine",
        "text": "我的"
      },
      {
        "pagePath": "pages/teacher/index",
        "text": "教师"
      },
      {
        "pagePath": "pages/teacher/pending/pending",
        "text": "审核"
      },
      {
        "pagePath": "pages/teacher/task-manage/task-manage",
        "text": "任务"
      },
      {
        "pagePath": "pages/teacher/mine/mine",
        "text": "我的"
      }
    ]
  }
}
```

---

## 9. 配置管理系统

### 9.1 已实现配置

项目已实现 `config/project.js` 配置服务，支持：

1. **项目列表管理** - 从服务器获取训练项目配置
2. **系统配置管理** - 获取积分、抽奖等系统参数
3. **本地缓存** - 配置数据本地缓存，减少请求
4. **默认配置** - 服务器不可用时使用默认配置

### 9.2 可配置参数清单

```javascript
// 默认配置（config/project.js）

{
  // ===== 积分相关 =====
  "points_register_gift": 50,      // 注册赠送积分
  "points_per_task": 10,           // 任务默认积分
  "points_daily_limit": 100,       // 每日积分上限

  // ===== 抽奖相关 =====
  "lottery_enabled": true,         // 抽奖功能开关
  "lottery_cost_points": 10,       // 每次抽奖消耗积分
  "lottery_daily_limit": 5,        // 每日抽奖次数上限

  // ===== 班级相关 =====
  "class_max_members": 50,         // 班级最大成员数
  "class_join_need_approval": true, // 加入班级需要审批

  // ===== 任务相关 =====
  "task_max_submissions": 3,       // 任务最大提交次数
  "task_overtime_penalty": 0.5     // 超时提交积分系数
}
```

---

## 10. 安全设计

### 10.1 身份认证

```javascript
// services/auth.js

// 获取当前用户 openid（安全方式）
function getOpenid() {
  // 从本地缓存获取
  return wx.getStorageSync('openid') || '';
}

// 验证用户身份
async function verifyUser() {
  const openid = getOpenid();
  if (!openid) return null;

  const res = await wx.cloud.callFunction({
    name: 'get-user-info'
  });

  return res.result?.success ? res.result.data : null;
}
```

### 10.2 云函数安全

```javascript
// 云函数安全中间件

// 获取真实 openid
function getRealOpenid() {
  const { OPENID } = cloud.getWXContext();
  return OPENID;
}

// 验证是否是教师
async function verifyTeacherRole(openid) {
  const db = cloud.database();
  const res = await db.collection('users')
    .where({ _openid: openid, status: 'active' })
    .get();
  return res.data.length > 0 && res.data[0].roles?.includes('teacher');
}

// 验证是否是班级教师
async function verifyClassTeacher(openid, classId) {
  const db = cloud.database();
  const res = await db.collection('classes')
    .where({ _id: classId, teacher_openid: openid })
    .count();
  return res.total > 0;
}
```

### 10.3 输入验证

```javascript
// utils/validate.js

// 手机号验证
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

// 用户名验证
function isValidUsername(name) {
  return name.length >= 2 && name.length <= 20;
}
```

---

## 11. 性能优化策略

### 11.1 数据库优化

```javascript
// 1. 使用索引
// 在云开发控制台创建索引

// 2. 批量查询替代循环查询
// ❌ 错误
for (const item of records) {
  const user = await db.collection('users')
    .where({ _openid: item.openid })
    .get();
}

// ✅ 正确
const openids = records.map(r => r.openid);
const users = await db.collection('users')
  .where({ _openid: _.in(openids) })
  .get();
const userMap = new Map(users.data.map(u => [u._openid, u]));

// 3. 只查询需要的字段
const res = await db.collection('users')
  .where({ status: 'active' })
  .field({
    _id: true,
    user_name: true,
    avatar_url: true,
    points: true
  })
  .get();
```

### 11.2 前端优化

```javascript
// 1. 列表分页加载
onReachBottom() {
  if (this.data.hasMore) {
    this.loadMore();
  }
}

// 2. 数据缓存
const cacheKey = 'tasks_list';
const cachedData = wx.getStorageSync(cacheKey);
if (cachedData && !this.isExpired(cachedData.time)) {
  this.setData({ taskList: cachedData.data });
} else {
  this.fetchTasks();
}

// 3. 防抖处理
const debounce = (fn, delay) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};
```

---

## 12. 开发流程

### 12.1 开发环境搭建

```bash
# 1. 克隆项目
git clone <repository-url>
cd ZhiLiKongMa

# 2. 安装依赖
npm install

# 3. 安装小程序依赖
cd miniprogram && npm install && cd ..

# 4. 配置环境变量
# 编辑 app.js 配置云环境ID

# 5. 打开微信开发者工具
# 导入项目，选择项目根目录

# 6. 构建 npm
# 在微信开发者工具中点击 "工具" -> "构建 npm"
```

### 12.2 开发规范

```javascript
// 1. 每个功能开发新分支
git checkout -b feature/user-profile

// 2. 代码提交前检查
npm run lint        // ESLint 检查

// 3. Commit 规范
git commit -m "feat(user): 添加用户资料编辑功能"

// 4. 代码审查
// 提交 PR，至少一人 Review

// 5. 测试
// 手动测试 + 云函数单元测试

// 6. 合并
// 合并到 develop 分支
```

---

## 附录

### A. 错误码定义

```javascript
// utils/constant.js

const ERROR_CODE = {
  // 通用错误
  SUCCESS: 0,
  UNKNOWN_ERROR: -1,
  PARAMS_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,

  // 用户相关 1000-1999
  USER_NOT_REGISTERED: 1001,
  USER_ALREADY_EXISTS: 1002,
  USER_DISABLED: 1003,

  // 班级相关 2000-2999
  CLASS_NOT_FOUND: 2001,
  CLASS_FULL: 2002,
  ALREADY_IN_CLASS: 2003,
  NOT_CLASS_MEMBER: 2004,

  // 任务相关 3000-3999
  TASK_NOT_FOUND: 3001,
  TASK_EXPIRED: 3002,
  SUBMISSION_LIMIT_EXCEEDED: 3003,
  ALREADY_SUBMITTED: 3004,

  // 积分相关 4000-4999
  POINTS_NOT_ENOUGH: 4001,
  POINTS_LIMIT_EXCEEDED: 4002,

  // 抽奖相关 5000-5999
  LOTTERY_DISABLED: 5001,
  LOTTERY_LIMIT_EXCEEDED: 5002,
  PRIZE_OUT_OF_STOCK: 5003
};
```

### B. API 响应格式

```javascript
// 统一响应格式
{
  success: boolean;      // 是否成功
  message?: string;      // 提示消息
  data?: any;           // 数据
  error_code?: number;  // 错误码
  total?: number;       // 总数（列表接口）
  page?: number;        // 当前页
  page_size?: number;   // 每页数量
}
```

---

**文档版本**: v3.0.0
**最后更新**: 2026-4-1
**编写者**: 开发团队
**更新说明**: 根据实际项目代码结构调整文档，更新为 JavaScript 实现，完善已完成功能文档，明确待开发功能清单
