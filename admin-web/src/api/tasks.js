import { callAdminFunction } from './cloudbase';

export function getTasks(params = {}) {
  return callAdminFunction('admin-manage-tasks', {
    action: 'list',
    ...params
  });
}

export function getTaskDetail(taskId) {
  return callAdminFunction('admin-manage-tasks', {
    action: 'get',
    task_id: taskId
  });
}

export function createTask(payload) {
  return callAdminFunction('admin-manage-tasks', {
    action: 'create',
    task: payload
  });
}

export function updateTask(payload) {
  return callAdminFunction('admin-manage-tasks', {
    action: 'update',
    task: payload
  });
}

export function deleteTask(payload) {
  return callAdminFunction('admin-manage-tasks', {
    action: 'delete',
    ...payload
  });
}

export function getTaskSubmissions(params = {}) {
  return callAdminFunction('admin-manage-tasks', {
    action: 'submissions',
    ...params
  });
}
