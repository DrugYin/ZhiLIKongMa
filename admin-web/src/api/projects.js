import { callAdminFunction } from './cloudbase';

export function getProjects(params = {}) {
  return callAdminFunction('admin-get-projects', params);
}

export function updateProject(payload) {
  return callAdminFunction('admin-update-project', payload);
}
