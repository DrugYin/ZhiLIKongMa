import { callAdminFunction } from './cloudbase';

export function getAnnouncements(params = {}) {
  return callAdminFunction('admin-manage-announcements', {
    action: 'list',
    ...params
  });
}

export function getAnnouncementDetail(id) {
  return callAdminFunction('admin-manage-announcements', {
    action: 'get',
    _id: id
  });
}

export function createAnnouncement(payload) {
  return callAdminFunction('admin-manage-announcements', {
    action: 'create',
    announcement: payload
  });
}

export function updateAnnouncement(payload) {
  return callAdminFunction('admin-manage-announcements', {
    action: 'update',
    announcement: payload
  });
}

export function deleteAnnouncement(payload) {
  return callAdminFunction('admin-manage-announcements', {
    action: 'delete',
    ...payload
  });
}

export function publishAnnouncement(id) {
  return callAdminFunction('admin-manage-announcements', {
    action: 'publish',
    _id: id
  });
}

export function closeAnnouncement(id) {
  return callAdminFunction('admin-manage-announcements', {
    action: 'close',
    _id: id
  });
}
