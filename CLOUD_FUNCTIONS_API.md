# 云函数 API 文档

本文档整理了当前项目中已存在的云函数接口，包括用户系统与班级管理系统。

## 通用说明

### 调用方式

前端统一通过 `wx.cloud.callFunction` 调用，当前项目已经封装在：

- `services/api.js`
- `services/auth.js`
- `services/class.js`

### 通用返回格式

大部分云函数统一返回如下结构：

```js
{
  success: true | false,
  message: '提示信息',
  data: {},
  error: '错误详情',
  error_code: 400 | 401 | 403 | 404 | 409 | 500
}
```

说明：

- `success`: 是否成功
- `message`: 用户可读提示
- `data`: 成功时返回的数据
- `error`: 失败时的技术错误信息
- `error_code`: 失败时的业务/状态码

### 身份获取

云函数内部统一通过：

```js
const { OPENID } = cloud.getWXContext();
```

获取当前调用用户的微信身份。

## 数据集合约定

当前云函数涉及以下集合：

- `users`
- `classes`
- `class_join_applications`
- `operation_logs`
- `system_config`

## 一、用户系统

### 1. `login`

#### 功能

获取当前用户 `openid`，用于后续注册和身份识别。

#### 入参

无

#### 返回示例

```js
{
  success: true,
  message: '登录成功',
  data: {
    openid: 'xxxxxx'
  }
}
```

#### 前端调用

```js
userApi.login()
```

---

### 2. `register`

#### 功能

注册新用户，默认注册为学生角色，并发放注册奖励积分。

#### 入参

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

#### 必填字段

- `user_name`
- `phone`

#### 返回示例

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
    points: 100
  }
}
```

#### 失败场景

- 用户已注册
- 缺少必填参数
- 数据库写入失败

#### 前端调用

```js
userApi.register(data)
AuthService.register(data)
```

---

### 3. `get-user-info`

#### 功能

获取当前登录用户的详细信息。

#### 入参

无

#### 返回示例

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
    teacher_subject: '',
    teacher_project: '',
    create_time: '...',
    update_time: '...'
  }
}
```

#### 未注册返回

```js
{
  success: true,
  is_registered: false,
  data: null
}
```

#### 前端调用

```js
userApi.getUserInfo()
AuthService.getUserInfo()
```

---

### 4. `get-user-roles`

#### 功能

获取当前用户拥有的角色列表及当前角色。

#### 入参

无

#### 预期返回示例

```js
{
  success: true,
  data: {
    roles: ['student', 'teacher'],
    current_role: 'student'
  }
}
```

#### 前端调用

当前项目中通常通过用户信息直接获取角色；如果单独需要角色信息，可通过该云函数扩展使用。

---

### 5. `switch-role`

#### 功能

切换当前用户角色，例如学生端切换到教师端，或教师端切换到学生端。

#### 入参

```js
{
  role: 'student' // 或 'teacher'
}
```

#### 返回示例

```js
{
  success: true,
  message: '切换成功',
  data: {
    current_role: 'teacher'
  }
}
```

#### 失败场景

- 目标角色不存在
- 当前用户不具备该角色权限

#### 前端调用

```js
userApi.switchRole(role)
AuthService.switchRole(role)
```

---

### 6. `update-user`

#### 功能

更新当前用户资料。

#### 入参

按页面填写内容传递，通常包括：

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

#### 返回示例

```js
{
  success: true,
  message: '更新成功',
  data: {}
}
```

#### 前端调用

```js
userApi.updateUser(data)
AuthService.updateUserInfo(data)
```

## 二、班级管理系统

### 1. `create-class`

#### 功能

教师创建班级，并生成唯一邀请码。

#### 入参

```js
{
  class_name: '黑羊编程 3 班',
  project_code: 'programming',
  project_name: '编程',
  grade: '三年级',
  description: '周六上午班',
  max_members: 50
}
```

#### 必填字段

- `class_name`

#### 返回示例

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
    grade: '三年级',
    description: '周六上午班',
    max_members: 50,
    member_count: 0,
    status: 'active',
    create_time: '...',
    update_time: '...'
  }
}
```

#### 权限要求

- 仅教师可调用

#### 前端调用

```js
classApi.createClass(data)
ClassService.createClass(data)
```

---

### 2. `get-classes`

#### 功能

获取班级列表。

#### 入参

```js
{
  role: 'teacher', // 默认 teacher
  page: 1,
  page_size: 20,
  sort_by: 'create_time', // 可选：create_time、update_time、class_name、member_count
  sort_order: 'desc' // 可选：asc、desc
}
```

#### 说明

- 当 `role = 'teacher'` 时，返回当前教师创建的班级列表
- 其他情况下，当前实现会尝试返回当前用户所属班级
- `sort_by` 默认是 `create_time`，仅在 `role = 'teacher'` 时生效
- `sort_order` 默认是 `desc`，传入非法值时会自动回退到默认值
- 为保证查询安全性，仅支持白名单字段排序

#### 排序示例

```js
classApi.getClasses({
  role: 'teacher',
  sort_by: 'update_time',
  sort_order: 'asc'
})

ClassService.getClasses({
  role: 'teacher',
  sort_by: 'member_count',
  sort_order: 'desc'
})
```

#### 返回示例

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

#### 前端调用

```js
classApi.getClasses(params)
ClassService.getClasses(params)
```

---

### 3. `get-class-detail`

#### 功能

获取单个班级详情。

#### 入参

```js
{
  class_id: 'class_id'
}
```

#### 返回示例

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

#### 权限要求

- 班级所属教师可查看
- 已加入该班级的成员可查看

#### 前端调用

```js
classApi.getClassDetail(classId)
ClassService.getClassDetail(classId)
```

---

### 4. `join-class`

#### 功能

学生通过班级邀请码申请加入班级。

#### 入参

```js
{
  class_code: 'AB12CD',
  apply_reason: '我是本班学员'
}
```

#### 返回示例

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

#### 失败场景

- 未注册
- 已加入班级
- 邀请码不存在
- 班级人数已满
- 已提交过待处理申请

#### 前端调用

```js
classApi.joinClass(classCode, applyReason)
ClassService.joinClass(classCode, applyReason)
```

---

### 5. `handle-join-application`

#### 功能

教师审批或拒绝学生的入班申请。

#### 入参

```js
{
  application_id: 'application_id',
  action: 'approve', // 或 reject
  review_remark: '通过'
}
```

#### 返回示例

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

#### 业务效果

- `approve`：
  - 更新申请状态为 `approved`
  - 更新学生 `users.class_id / class_name / class_code / join_class_time`
  - `classes.member_count + 1`
- `reject`：
  - 更新申请状态为 `rejected`

#### 前端调用

```js
classApi.handleApplication({
  application_id,
  action,
  review_remark
})

ClassService.handleApplication({
  application_id,
  action,
  review_remark
})
```

---

### 6. `get-class-members`

#### 功能

获取班级成员列表。

#### 入参

```js
{
  class_id: 'class_id',
  page: 1,
  page_size: 20
}
```

#### 返回示例

```js
{
  success: true,
  message: '获取班级成员成功',
  data: {
    list: [
      {
        _id: 'user_id',
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

#### 权限要求

- 班级所属教师可查看
- 已加入该班级的成员可查看

#### 前端调用

```js
classApi.getClassMembers(params)
ClassService.getClassMembers(params)
```

---

### 7. `remove-member`

#### 功能

教师移除班级成员。

#### 入参

```js
{
  class_id: 'class_id',
  member_openid: 'student_openid'
}
```

#### 返回示例

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

#### 业务效果

- 清除用户的：
  - `class_id`
  - `class_name`
  - `class_code`
  - `join_class_time`
- `classes.member_count - 1`

#### 权限要求

- 仅班级所属教师可调用

#### 前端调用

```js
classApi.removeMember(classId, memberOpenid)
ClassService.removeMember(classId, memberOpenid)
```

## 三、前端封装对照

### 用户模块

- `services/api.js` 中的 `userApi`
- `services/auth.js` 中的 `AuthService`

### 班级模块

- `services/api.js` 中的 `classApi`
- `services/class.js` 中的 `ClassService`

## 四、建议的后续补充

后面如果你继续完善接口，我建议同步补充到这份文档中的内容有：

- `switch-role` 的完整错误码语义
- `update-user` 的详细可更新字段
- `get-user-roles` 的实际返回结构
- 班级申请列表接口
- 教师端班级搜索、分页、状态筛选接口
- 接口错误码统一表
