# 智慧控码后台管理网站

该目录是智慧控码训练系统的独立后台管理网站，目标是承载运营统计、系统配置、项目配置、用户查询、任务提交查看和操作日志等管理能力。

## 技术栈

- Vue 3
- Vite
- TDesign Vue Next
- Pinia
- Vue Router Hash 模式
- ECharts
- CloudBase Web SDK

## 本地启动

```bash
cd admin-web
npm install
npm run dev
```

首次启动前复制环境变量：

```bash
cp .env.example .env.local
```

Windows PowerShell 可手动复制 `.env.example` 为 `.env.local`。

## 构建

```bash
npm run build
```

构建产物输出到：

```text
admin-web/dist/
```

## 云函数约定

后台前端不直接修改敏感集合，统一调用 `admin-*` 云函数：

- `admin-auth-check`
- `admin-get-statistics`
- `admin-get-config`
- `admin-update-config`
- `admin-get-projects`
- `admin-update-project`
- `admin-get-users`
- `admin-get-tasks`
- `admin-get-submissions`
- `admin-get-operation-logs`
- `admin-refresh-ranking`

## 部署建议

部署到 CloudBase 静态网站托管的 `/admin/` 子目录，并使用 Hash 路由：

```text
/admin/#/dashboard
```

## 当前状态

当前已完成前端工程骨架和接口封装，页面以占位和接口预留为主。下一步建议先实现 `admin-auth-check` 云函数，再接入真实登录与权限校验。
