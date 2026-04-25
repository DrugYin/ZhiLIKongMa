import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import AdminLayout from '@/layouts/AdminLayout.vue';
import LoginPage from '@/pages/login/LoginPage.vue';
import DashboardPage from '@/pages/dashboard/DashboardPage.vue';
import ConfigPage from '@/pages/config/ConfigPage.vue';
import ProjectsPage from '@/pages/projects/ProjectsPage.vue';
import UsersPage from '@/pages/users/UsersPage.vue';
import ClassesPage from '@/pages/classes/ClassesPage.vue';
import TasksPage from '@/pages/tasks/TasksPage.vue';
import SubmissionsPage from '@/pages/submissions/SubmissionsPage.vue';
import LogsPage from '@/pages/logs/LogsPage.vue';
import AnnouncementsPage from '@/pages/announcements/AnnouncementsPage.vue';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { public: true }
  },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: DashboardPage, meta: { title: '运营概览' } },
      { path: 'config', name: 'config', component: ConfigPage, meta: { title: '系统配置' } },
      { path: 'projects', name: 'projects', component: ProjectsPage, meta: { title: '项目配置' } },
      { path: 'users', name: 'users', component: UsersPage, meta: { title: '用户管理' } },
      { path: 'classes', name: 'classes', component: ClassesPage, meta: { title: '班级管理' } },
      { path: 'tasks', name: 'tasks', component: TasksPage, meta: { title: '任务管理' } },
      { path: 'announcements', name: 'announcements', component: AnnouncementsPage, meta: { title: '公告管理' } },
      { path: 'submissions', name: 'submissions', component: SubmissionsPage, meta: { title: '提交记录' } },
      { path: 'logs', name: 'logs', component: LogsPage, meta: { title: '操作日志' } }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (to.meta.public) {
    return true;
  }

  if (!authStore.initialized) {
    await authStore.bootstrap();
  }

  if (!authStore.isAdmin) {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    };
  }

  return true;
});

export default router;
