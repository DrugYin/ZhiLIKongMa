import { callAdminFunction } from './cloudbase';

export function getClasses(params = {}) {
  return callAdminFunction('admin-manage-classes', {
    action: 'list',
    ...params
  });
}

export function getClassDetail(classId) {
  return callAdminFunction('admin-manage-classes', {
    action: 'get',
    class_id: classId
  });
}

export function createClass(payload) {
  return callAdminFunction('admin-manage-classes', {
    action: 'create',
    class_info: payload
  });
}

export function updateClass(payload) {
  return callAdminFunction('admin-manage-classes', {
    action: 'update',
    class_info: payload
  });
}

export function deleteClass(payload) {
  return callAdminFunction('admin-manage-classes', {
    action: 'delete',
    ...payload
  });
}

export function getClassMembers(params = {}) {
  return callAdminFunction('admin-manage-classes', {
    action: 'members',
    ...params
  });
}

export function removeClassMember(payload) {
  return callAdminFunction('admin-manage-classes', {
    action: 'remove_member',
    ...payload
  });
}

export function getClassApplications(params = {}) {
  return callAdminFunction('admin-manage-classes', {
    action: 'applications',
    ...params
  });
}

export function reviewClassApplication(payload) {
  return callAdminFunction('admin-manage-classes', {
    action: 'review_application',
    ...payload
  });
}
