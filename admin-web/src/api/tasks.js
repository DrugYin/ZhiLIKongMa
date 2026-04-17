import { callAdminFunction } from './cloudbase';

export function getTasks(params = {}) {
  return callAdminFunction('admin-get-tasks', params);
}

export function getSubmissions(params = {}) {
  return callAdminFunction('admin-get-submissions', params);
}
