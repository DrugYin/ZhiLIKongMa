import { callAdminFunction } from './cloudbase';

export function getProjects(params = {}) {
  return callAdminFunction('admin-manage-projects', {
    action: 'list',
    ...params
  });
}

export function getProjectDetail(projectCode) {
  return callAdminFunction('admin-manage-projects', {
    action: 'get',
    project_code: projectCode
  });
}

export function createProject(payload) {
  return callAdminFunction('admin-manage-projects', {
    action: 'create',
    project: payload
  });
}

export function updateProject(payload) {
  return callAdminFunction('admin-manage-projects', {
    action: 'update',
    project: payload
  });
}

export function deleteProject(payload) {
  return callAdminFunction('admin-manage-projects', {
    action: 'delete',
    ...payload
  });
}

export function seedDefaultProjects() {
  return callAdminFunction('admin-manage-projects', {
    action: 'seed_defaults'
  });
}
