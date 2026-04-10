# 云函数 API 文档

本文档基于当前仓库代码同步整理，覆盖已经落地的用户系统、班级管理、任务管理、提交审核、排行榜与项目配置云函数，并标注前端已接入情况与仍待实现的调用入口。

## 通用说明

### 调用方式

前端统一通过 `wx.cloud.callFunction` 调用，当前封装入口如下：

- `services/api.js`
- `services/auth.js`
- `services/class.js`
- `services/ranking.js`
- `services/task.js`

### 通用返回格式

大部分云函数统一返回以下结构：

```js
{
  success: true | false,
  message: '提示信息',
  data: {},
  error: '错误详情',
  error_code: 400 | 401 | 403 | 404 | 409 | 500
}
```

补充字段：

- `is_registered`: `get-user-info` 返回，标记用户是否已注册
- `total`: `get-projects` 返回列表总数
- `source`: `get-projects` 返回数据来源，`database` 或 `default`

### 身份与权限

云函数内部统一通过以下方式获取调用用户身份：

```js
const { OPENID } = cloud.getWXContext();
```

教师权限接口会额外校验：

- `users.roles` 是否包含 `teacher`
- 目标班级是否属于当前教师

### 当前涉及集合

- `users`
- `classes`
- `class_memberships`
- `class_join_applications`
- `tasks`
- `submissions`
- `projects`
- `system_config`
- `operation_logs`

## 一、用户系统

### 1. `login`

功能：获取当前用户 `openid`，用于后续注册和身份识别。

入参：无

返回示例：

```js
{
  success: true,
  message: '登录成功',
  data: {
    openid: 'xxxxxx'
  }
}
```

前端调用：

```js
userApi.login()
AuthService.wxLogin()
```

---

### 2. `register`

功能：注册新用户，默认创建学生角色，并按系统配置发放注册积分。

入参：

```js
{
  user_name: '张三',
  nick_name: '小张',
  avatar_url: 'cloud://xxx/avatar.png',
  phone: '13800000000',
  school: '某某学校',
  grade: '三年级',
  birthday: '2018-01-01',
  address: '深圳市...'
}
```

必填字段：

- `user_name`
- `phone`

返回示例：

```js
{
  success: true,
  message: '注册成功',
  data: {
    _id: 'user_id',
    user_name: '张三',
    avatar_url: 'cloud://xxx/avatar.png',
    roles: ['student'],
    current_role: 'student',
    points: 50
  }
}
```

失败场景：

- 用户已注册
- 缺少必填参数
- 数据库写入失败

前端调用：

```js
userApi.register(data)
AuthService.register(data)
```

---

### 3. `get-user-info`

功能：获取当前登录用户的详细信息。

入参：无

返回示例：

```js
{
  success: true,
  is_registered: true,
  data: {
    _id: 'user_id',
    user_name: '张三',
    avatar_url: 'cloud://xxx/avatar.png',
    phone: '13800000000',
    school: '某某学校',
    grade: '三年级',
    birthday: '2018-01-01',
    address: '深圳市...',
    roles: ['student', 'teacher'],
    current_role: 'student',
    points: 100,
    total_points: 300,
    status: 'active',
    teacher_project: '编程',
    create_time: '...',
    update_time: '...'
  }
}
```

未注册返回：

```js
{
  success: true,
  is_registered: false,
  data: null
}
```

前端调用：

```js
userApi.getUserInfo()
AuthService.getUserInfo()
```

---

### 4. `get-user-roles`

功能：获取当前用户拥有的角色列表及当前角色。

入参：无

返回示例：

```js
{
  success: true,
  data: {
    roles: ['student', 'teacher'],
    current_role: 'student'
  }
}
```

前端现状：

- 当前前端主要通过 `get-user-info` 中的用户信息判断角色
- 本接口已实现，但暂无独立页面直接调用

---

### 5. `switch-role`

功能：切换当前用户角色视图。

入参：

```js
{
  role: 'student' // 或 'teacher'
}
```

返回示例：

```js
{
  success: true,
  message: '角色切换成功',
  data: {
    current_role: 'teacher',
    roles: ['student', 'teacher']
  }
}
```

失败场景：

- 目标角色非法
- 用户不存在
- 当前用户不具备目标角色

前端调用：

```js
userApi.switchRole(role)
AuthService.switchRole(role)
```

---

### 6. `update-user`

功能：更新当前用户资料。

入参：

```js
{
  user_name: '张三',
  avatar_url: 'cloud://xxx/avatar.png',
  phone: '13800000000',
  school: '某某学校',
  grade: '三年级',
  birthday: '2018-01-01',
  address: '深圳市...'
}
```

说明：

- 所有字段均按“传了才更新”的方式处理
- `user_name` 长度限制为 2-20
- `phone` 会校验手机号格式

返回示例：

```js
{
  success: true,
  message: '更新成功'
}
```

前端调用：

```js
userApi.updateUser(data)
AuthService.updateUserInfo(data)
```

## 二、班级管理系统

### 当前实现概览

- 班级成员关系以 `class_memberships` 为主表，`users.class_id / class_name / class_code / join_class_time` 仅保留兼容旧数据。
- 学生端已接入 `/pages/student/class-manage/class-manage` 与 `/pages/student/class-manage/join-confirm/join-confirm`。
- 教师端已在 `/pages/teacher/class-manage/class-detail/class-detail` 中接入邀请分享、申请审批、成员移除。

### 1. `create-class`

功能：教师创建班级，并生成唯一邀请码。

入参：

```js
{
  class_name: '黑羊编程 3 班',
  project_code: 'programming',
  project_name: '编程',
  class_time: '周六 09:00-11:00',
  location: 'A301 教室',
  description: '周六上午班',
  max_members: 50
}
```

必填字段：

- `class_name`

返回示例：

```js
{
  success: true,
  message: '创建班级成功',
  data: {
    _id: 'class_id',
    class_name: '黑羊编程 3 班',
    class_code: 'AB12CD',
    teacher_openid: 'teacher_openid',
    teacher_name: '王老师',
    project_code: 'programming',
    project_name: '编程',
    class_time: '周六 09:00-11:00',
    location: 'A301 教室',
    description: '周六上午班',
    max_members: 50,
    member_count: 0,
    status: 'active',
    create_time: '...',
    update_time: '...'
  }
}
```

权限要求：

- 仅教师可调用

前端调用：

```js
classApi.createClass(data)
ClassService.createClass(data)
```

---

### 2. `update-class`

功能：教师更新自己创建的班级信息。

入参：

```js
{
  class_id: 'class_id',
  class_name: '黑羊编程 3 班',
  project_code: 'programming',
  project_name: '编程',
  class_time: '周六 09:00-11:00',
  location: 'A301 教室',
  description: '周六上午班',
  max_members: 50
}
```

校验规则：

- `class_id`、`class_name`、`project_code` 必填
- `max_members` 必须为正整数
- `max_members` 不能小于当前班级成员数

业务效果：

- 更新 `classes` 主记录
- 同步更新旧版兼容数据中的 `users.class_name`
- 同步更新 `class_join_applications.class_name / class_code`

前端调用：

```js
classApi.updateClass(data)
ClassService.updateClass(data)
```

---

### 3. `delete-class`

功能：教师删除自己创建的班级。

入参：

```js
{
  class_id: 'class_id'
}
```

返回示例：

```js
{
  success: true,
  message: '删除班级成功',
  data: {
    class_id: 'class_id',
    member_count: 18
  }
}
```

业务效果：

- 将班级状态改为 `deleted`
- 删除 `class_memberships` 中该班级所有成员关系
- 清空旧版兼容字段 `users.class_id / class_name / class_code / join_class_time`
- 将待处理入班申请统一改为 `rejected`

前端调用：

```js
classApi.deleteClass(classId)
ClassService.deleteClass(classId)
```

---

### 4. `get-classes`

功能：获取班级列表。

入参：

```js
{
  role: 'teacher', // teacher 或 student
  page: 1,
  page_size: 20,
  sort_by: 'create_time', // create_time、update_time、class_name、member_count
  sort_order: 'desc' // asc、desc
}
```

说明：

- `role = 'teacher'` 时，返回当前教师创建的班级列表，支持分页与排序。
- 其他情况下，返回当前用户已加入的全部班级。
- 学生端班级列表来自 `class_memberships`，同时兼容旧版 `users.class_id`。

返回示例：

```js
{
  success: true,
  message: '获取班级列表成功',
  data: {
    list: [
      {
        _id: 'class_id',
        class_name: '黑羊编程 3 班',
        class_code: 'AB12CD',
        member_count: 20,
        max_members: 50,
        status: 'active'
      }
    ],
    page: 1,
    page_size: 20,
    total: 1,
    has_more: false
  }
}
```

前端调用：

```js
classApi.getClasses(params)
ClassService.getClasses(params)
```

---

### 5. `get-class-detail`

功能：获取单个班级详情。

入参：

```js
{
  class_id: 'class_id'
}
```

返回示例：

```js
{
  success: true,
  message: '获取班级详情成功',
  data: {
    _id: 'class_id',
    class_name: '黑羊编程 3 班',
    class_code: 'AB12CD',
    teacher_openid: 'teacher_openid',
    teacher_name: '王老师',
    member_count: 20,
    max_members: 50,
    status: 'active',
    pending_application_count: 3
  }
}
```

权限要求：

- 班级所属教师可查看
- 已加入该班级的成员可查看

说明：

- `pending_application_count` 仅教师查看时会返回真实数量，学生侧默认为 `0`。

前端调用：

```js
classApi.getClassDetail(classId)
ClassService.getClassDetail(classId)
```

---

### 6. `get-class-invite-info`

功能：根据邀请码获取班级邀请页展示信息。

入参：

```js
{
  class_code: 'AB12CD'
}
```

返回示例：

```js
{
  success: true,
  message: '获取班级邀请信息成功',
  data: {
    _id: 'class_id',
    class_name: '黑羊编程 3 班',
    class_code: 'AB12CD',
    teacher_name: '王老师',
    project_code: 'programming',
    project_name: '编程',
    class_time: '周六 09:00-11:00',
    location: 'A301 教室',
    description: '周六上午班',
    member_count: 20,
    max_members: 50,
    is_full: false
  }
}
```

使用场景：

- 学生输入邀请码后的确认页
- 教师从班级详情页分享出去的邀请链接落地页

前端调用：

```js
classApi.getClassInviteInfo(classCode)
ClassService.getClassInviteInfo(classCode)
```

---

### 7. `get-my-class-status`

功能：获取当前学生的班级状态、已加入班级和待审核申请。

入参：

```js
{}
```

返回示例：

```js
{
  success: true,
  is_registered: true,
  data: {
    status: 'joined', // joined、pending、none、guest
    joined_class_count: 2,
    joined_classes: [
      {
        _id: 'class_id',
        class_name: '黑羊编程 3 班',
        class_code: 'AB12CD',
        join_class_time: '...'
      }
    ],
    pending_application_count: 1,
    pending_applications: [
      {
        _id: 'application_id',
        class_id: 'class_id',
        class_name: '无人机冲刺班',
        class_code: 'CD34EF',
        apply_reason: '想继续进阶'
      }
    ]
  }
}
```

说明：

- 当前已支持一个学生加入多个班级。
- 未注册时返回 `success: true`、`is_registered: false`，前端据此跳登录或注册流程。

前端调用：

```js
classApi.getMyClassStatus()
ClassService.getMyClassStatus()
```

---

### 8. `join-class`

功能：学生通过班级邀请码申请加入班级。

入参：

```js
{
  class_code: 'AB12CD',
  apply_reason: '我是本班学员'
}
```

返回示例：

```js
{
  success: true,
  message: '提交入班申请成功',
  data: {
    _id: 'application_id',
    class_id: 'class_id',
    class_code: 'AB12CD',
    class_name: '黑羊编程 3 班',
    student_openid: 'student_openid',
    student_name: '张三',
    apply_reason: '我是本班学员',
    status: 'pending',
    create_time: '...',
    update_time: '...'
  }
}
```

失败场景：

- 未注册
- 已加入当前班级
- 邀请码不存在或班级已停用
- 班级人数已满
- 已提交过当前班级的待处理申请

前端现状：

- 学生端班级管理页和确认页已接入
- 教师分享链接会直接落到学生确认页

---

### 9. `get-class-applications`

功能：教师获取某个班级的待审批入班申请列表。

入参：

```js
{
  class_id: 'class_id',
  page: 1,
  page_size: 20
}
```

返回示例：

```js
{
  success: true,
  message: '获取入班申请成功',
  data: {
    list: [
      {
        _id: 'application_id',
        class_id: 'class_id',
        class_code: 'AB12CD',
        class_name: '黑羊编程 3 班',
        student_openid: 'student_openid',
        student_name: '张三',
        student_user_name: '张三',
        student_nick_name: '小张',
        student_avatar: 'cloud://xxx/avatar.png',
        student_grade: '三年级',
        student_phone: '13800000000',
        apply_reason: '我是本班学员',
        status: 'pending',
        create_time: '...',
        update_time: '...'
      }
    ],
    page: 1,
    page_size: 20,
    total: 1,
    has_more: false
  }
}
```

权限要求：

- 仅班级所属教师可调用

前端调用：

```js
classApi.getClassApplications(params)
ClassService.getClassApplications(params)
```

---

### 10. `handle-join-application`

功能：教师审批或拒绝学生的入班申请。

入参：

```js
{
  application_id: 'application_id',
  action: 'approve', // 或 reject
  review_remark: '通过'
}
```

返回示例：

```js
{
  success: true,
  message: '通过申请成功',
  data: {
    application_id: 'application_id',
    class_id: 'class_id',
    status: 'approved'
  }
}
```

业务效果：

- `approve`
  - 更新申请状态为 `approved`
  - 若学生尚未加入该班，则新增一条 `class_memberships`
  - `classes.member_count + 1`
- `reject`
  - 更新申请状态为 `rejected`

说明：

- 当前审批通过后不会清理学生在其他班级的成员关系，多班级共存是当前实现的一部分。
- 教师端已在班级详情页接入通过/拒绝按钮，独立审核 Tab 仍为占位页。

---

### 11. `get-class-members`

功能：获取班级成员列表。

入参：

```js
{
  class_id: 'class_id',
  page: 1,
  page_size: 20
}
```

返回示例：

```js
{
  success: true,
  message: '获取班级成员成功',
  data: {
    list: [
      {
        _openid: 'student_openid',
        user_name: '张三',
        nick_name: '小张',
        avatar_url: 'cloud://xxx/avatar.png',
        grade: '三年级',
        phone: '13800000000',
        join_class_time: '...',
        points: 100,
        total_points: 300
      }
    ],
    page: 1,
    page_size: 20,
    total: 1,
    has_more: false
  }
}
```

说明：

- 当前实现会合并 `class_memberships` 与旧版 `users.class_id` 数据，避免历史成员丢失。

权限要求：

- 班级所属教师可查看
- 已加入该班级的成员可查看

前端调用：

```js
classApi.getClassMembers(params)
ClassService.getClassMembers(params)
```

---

### 12. `remove-member`

功能：教师移除班级成员。

入参：

```js
{
  class_id: 'class_id',
  member_openid: 'student_openid'
}
```

返回示例：

```js
{
  success: true,
  message: '移除成员成功',
  data: {
    class_id: 'class_id',
    member_openid: 'student_openid'
  }
}
```

业务效果：

- 删除 `class_memberships` 中对应关系
- 若命中旧版兼容字段，则清除 `users.class_id / class_name / class_code / join_class_time`
- `classes.member_count - 1`

权限要求：

- 仅班级所属教师可调用

前端调用：

```js
classApi.removeMember(classId, memberOpenid)
ClassService.removeMember(classId, memberOpenid)
```

## 三、项目配置

### 1. `get-projects`

功能：获取训练项目列表；优先读取数据库 `projects`，为空时回退默认项目配置。

入参：

```js
{
  status: 'active' // 可选
}
```

返回示例：

```js
{
  success: true,
  message: '获取项目列表成功',
  data: [
    {
      project_name: '编程',
      project_code: 'programming',
      task_categories: ['基础语法', '算法练习'],
      difficulty_levels: [
        { level: 1, name: '入门', color: '#52c41a' }
      ],
      status: 'active'
    }
  ],
  total: 3,
  source: 'database'
}
```

说明：

- 当数据库没有项目数据时，`source` 会返回 `default`
- `config/project.js`、`pages/teacher/class-manage` 已通过该接口读取项目列表
- `services/api.js` 中 `configApi.getProjects()` 为统一调用入口

## 四、任务管理系统

### 当前实现概览

- 教师端已接入 `/pages/teacher/task-manage/task-manage`、`/pages/teacher/task-manage/task-detail/task-detail`、`/pages/teacher/task-manage/task-edit/task-edit`
- 学生端已接入 `/pages/student/task-manage/task-manage`、`/pages/student/task-manage/task-detail/task-detail`、`/pages/student/task-manage/submission-edit/submission-edit`、`/pages/student/task-manage/submission-records/submission-records`
- 教师审核页 `/pages/teacher/pending/pending` 已接入真实提交记录、审核弹层、反馈图片/附件与积分发放
- 服务层已提供 `services/task.js`，统一封装任务创建、查询、详情、更新、删除、提交、记录查询与审核

### 1. `create-task`

功能：教师创建任务，支持公开任务和班级任务两类，创建后写入 `tasks` 与 `operation_logs`，班级任务会同步更新班级统计字段。

入参：

```js
{
  title: '算法热身训练',
  description: '完成 3 道基础算法题并整理思路',
  task_type: 'class', // class 或 public
  visibility: 'class_only', // class_only 或 public；public 任务会被归一成 public
  class_id: 'class_id', // 班级任务必填
  project_code: 'programming',
  project_name: '编程',
  category: '基础训练',
  difficulty: 2,
  points: 10,
  status: 'published', // draft、published、closed
  deadline_date: '2026-04-15',
  deadline_time: '20:00',
  cover_image: 'cloud://xxx/cover.png',
  images: ['cloud://xxx/1.png'],
  files: [
    {
      file_id: 'cloud://xxx/guide.pdf',
      file_name: '题目说明.pdf',
      file_size: 102400
    }
  ]
}
```

说明：

- 仅教师可调用
- `task_type = 'class'` 时必须传 `class_id`，且班级必须属于当前教师
- 难度限制为 `1-5` 整数，积分限制为大于等于 `0` 的整数
- 截止日期和截止时间要么同时为空，要么同时合法

返回示例：

```js
{
  success: true,
  message: '创建任务成功',
  data: {
    _id: 'task_id',
    title: '算法热身训练',
    task_type: 'class',
    visibility: 'class_only',
    class_id: 'class_id',
    status: 'published'
  }
}
```

### 2. `get-tasks`

功能：获取任务列表。

入参：

```js
{
  role: 'teacher', // teacher 或 student；不传时默认按当前用户 current_role 处理
  page: 1,
  page_size: 20,
  task_type: 'class',
  visibility: 'class_only',
  status: 'published',
  class_id: 'class_id',
  sort_by: 'update_time', // create_time、update_time、publish_time、deadline、difficulty、points
  sort_order: 'desc'
}
```

权限与行为：

- 教师模式：仅返回当前教师创建的未删除任务，支持按状态、范围、班级、排序分页查询
- 学生模式：仅返回已发布且当前学生可见的任务
- 学生可见规则：
  - `public` 任务始终可见
  - `class + public` 任务公开可见
  - `class + class_only` 任务仅当前学生已加入班级可见

返回示例：

```js
{
  success: true,
  message: '获取任务列表成功',
  data: {
    list: [],
    page: 1,
    page_size: 20,
    total: 0,
    has_more: false
  }
}
```

### 3. `get-task-detail`

功能：获取单个任务详情。

入参：

```js
{
  task_id: 'task_id'
}
```

权限规则：

- 任务所属教师可直接查看
- 学生仅能查看自己有权限访问的已发布任务
- 已删除任务会直接返回 `404`

返回示例：

```js
{
  success: true,
  message: '获取任务详情成功',
  data: {
    _id: 'task_id',
    title: '算法热身训练',
    description: '完成 3 道基础算法题并整理思路',
    task_type: 'class',
    visibility: 'class_only',
    status: 'published',
    images: [],
    files: []
  }
}
```

### 4. `update-task`

功能：教师更新自己创建的任务。

入参：

```js
{
  task_id: 'task_id',
  title: '算法热身训练（更新版）',
  description: '补充了题目说明',
  task_type: 'class',
  visibility: 'class_only',
  class_id: 'class_id',
  project_code: 'programming',
  project_name: '编程',
  category: '基础训练',
  difficulty: 3,
  points: 12,
  status: 'published',
  deadline_date: '2026-04-16',
  deadline_time: '20:00',
  cover_image: 'cloud://xxx/cover.png',
  images: ['cloud://xxx/1.png'],
  files: []
}
```

说明：

- 仅任务所属教师可更新
- 所有字段按“传了才更新”的策略处理
- 若任务所属班级或状态变化，会同步调整 `classes.task_count / published_task_count`

返回示例：

```js
{
  success: true,
  message: '更新任务成功',
  data: {
    _id: 'task_id',
    title: '算法热身训练（更新版）',
    status: 'published'
  }
}
```

### 5. `delete-task`

功能：教师删除自己创建的任务。

入参：

```js
{
  task_id: 'task_id'
}
```

说明：

- 删除采用软删除：写入 `is_deleted = true`、`delete_time`
- 删除后任务状态会被置为 `closed`
- 若原任务为班级任务，会同步回退班级任务统计

返回示例：

```js
{
  success: true,
  message: '删除任务成功',
  data: {
    task_id: 'task_id'
  }
}
```

### 6. `submit-task`

功能：学生提交任务，支持填写提交说明、上传图片和附件，并记录提交次数与是否超时。

入参：

```js
{
  task_id: 'task_id',
  description: '已完成 3 道题，附上解题截图',
  images: ['cloud://xxx/submission-1.png'],
  files: [
    {
      file_id: 'cloud://xxx/report.pdf',
      file_name: '作业说明.pdf',
      file_size: 204800
    }
  ]
}
```

说明：

- 仅已注册学生可调用
- `description`、`images`、`files` 至少要传一项
- 会校验任务是否可见、是否已删除、是否已发布
- 会按 `system_config.task_max_submissions` 与任务自身 `max_submissions` 限制提交次数
- 超过截止时间仍可提交，但会写入 `is_overtime = true`

返回示例：

```js
{
  success: true,
  message: '提交任务成功',
  data: {
    _id: 'submission_id',
    task_id: 'task_id',
    task_title: '算法热身训练',
    submission_no: 1,
    status: 'pending',
    is_overtime: false,
    images: ['cloud://xxx/submission-1.png'],
    files: []
  }
}
```

### 7. `get-submissions`

功能：获取提交记录列表，学生查看自己的提交历史，教师查看自己名下任务的提交记录。

入参：

```js
{
  role: 'teacher', // teacher 或 student，不传时默认按当前角色处理
  task_id: 'task_id', // 可选
  status: 'pending', // 可选
  class_id: 'class_id', // 可选
  page: 1,
  page_size: 20
}
```

说明：

- 学生模式：仅返回当前学生自己的提交记录
- 教师模式：仅返回当前教师创建任务的提交记录
- 传 `task_id` 时会额外校验任务访问权限
- 当前已用于学生任务详情页最近两次提交、学生总提交记录页、教师审核列表页

返回示例：

```js
{
  success: true,
  message: '获取提交记录成功',
  data: {
    list: [
      {
        _id: 'submission_id',
        task_id: 'task_id',
        task_title: '算法热身训练',
        student_name: '张三',
        class_name: '黑羊编程 3 班',
        status: 'pending',
        submit_time: '2026-04-09T10:00:00.000Z',
        points_earned: 0
      }
    ],
    page: 1,
    page_size: 20,
    total: 1,
    has_more: false
  }
}
```

### 8. `review-submission`

功能：教师审核提交记录，支持通过或驳回、打分、填写处理意见，并上传反馈图片和附件。

入参：

```js
{
  submission_id: 'submission_id',
  status: 'approved', // approved 或 rejected
  score: 95,
  feedback: '思路正确，注意变量命名规范',
  points_earned: 10, // 不传时默认取任务积分；驳回时强制记为 0
  feedback_images: ['cloud://xxx/review-1.png'],
  feedback_files: [
    {
      file_id: 'cloud://xxx/comment.pdf',
      file_name: '批注.pdf',
      file_size: 102400
    }
  ]
}
```

说明：

- 仅教师可调用，且只能审核自己任务下的提交记录
- 仅 `pending` 状态的提交记录可审核
- 审核通过会增加学生积分；驳回时无论传什么积分，都会写入 `0`
- 未填写处理意见时会自动补默认反馈文案

返回示例：

```js
{
  success: true,
  message: '审核提交记录成功',
  data: {
    _id: 'submission_id',
    status: 'approved',
    score: 95,
    feedback: '思路正确，注意变量命名规范',
    points_earned: 10,
    feedback_images: ['cloud://xxx/review-1.png'],
    feedback_files: []
  }
}
```

## 五、排行榜

### 1. `get-ranking`

功能：获取学生积分排行榜，支持周榜、月榜和总榜。

入参：

```js
{
  rank_type: 'week' // week、month、total
}
```

说明：

- 仅统计 `users.roles` 中包含 `student` 的有效用户
- 周榜按“上周六 00:00:00 到本周五 23:59:59.999”统计审核通过后发放的积分
- 月榜按“当前月 1 日 00:00:00 到下月 1 日前一毫秒”统计审核通过后发放的积分
- 总榜按 `users.total_points` 排序
- 周榜和月榜均基于 `submissions.status = approved` 且 `review_time` 落在统计周期内的数据聚合
- 当前实现会过滤 `0` 分用户，未上榜用户在前端显示为“未上榜”

返回示例：

```js
{
  success: true,
  message: '获取排行榜成功',
  data: {
    rank_type: 'week',
    participant_count: 12,
    current_user: {
      _openid: 'openid_xxx',
      name: '张三',
      points: 30,
      rank: 2
    },
    top_three: [],
    list: []
  }
}
```

前端调用：

```js
RankingService.getRanking({ rank_type: 'week' })
```

前端现状：

- 学生端 `/pages/student/rank/rank` 已接入真实周榜、月榜、总榜
- 学生首页 `/pages/student/index` 已接入真实周排名摘要
- `get-ranking` 已在云环境 `zhi-li-kong-ma-7gy2aqcr1add21a7` 完成部署

## 六、前端封装对照

### 用户模块

- `services/api.js` 中的 `userApi`
- `services/auth.js` 中的 `AuthService`

### 班级模块

- `services/api.js` 中的 `classApi`
- `services/class.js` 中的 `ClassService`
- 已落地方法：`createClass`、`updateClass`、`deleteClass`、`getClasses`、`getClassDetail`、`getClassInviteInfo`、`getMyClassStatus`、`joinClass`、`getClassApplications`、`handleApplication`、`getClassMembers`、`removeMember`

### 任务模块

- `services/api.js` 中的 `taskApi`
- `services/task.js` 中的 `TaskService`
- 已落地方法：`createTask`、`getTasks`、`getTaskDetail`、`updateTask`、`deleteTask`、`submitTask`、`getSubmissions`、`reviewSubmission`

### 排行榜模块

- `services/ranking.js` 中的 `RankingService`
- 已落地方法：`getRanking`

### 配置模块

- `services/api.js` 中的 `configApi`
- `config/project.js` 中的 `ProjectService`

## 七、当前未落地但已预留的调用入口

以下方法已经在 `services/api.js` 中预留，但仓库中还没有对应云函数实现：

- 抽奖：`get-prizes`、`start-draw`、`get-draw-records`
- 配置：`get-config`

同步建议：

- 新增云函数时，优先更新本文件与 `DEVELOPMENT_PLAN.md`
- 当前若继续推进任务/审核与统计模块，建议优先补 `get-submission-detail`、`get-class-ranking`、`get-statistics`，再补积分明细与抽奖链路
