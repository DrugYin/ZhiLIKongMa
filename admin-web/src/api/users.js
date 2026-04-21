import { callAdminFunction, isCloudFileID, isWebURL, resolveCloudFileURLs } from './cloudbase';

function getAvatarDisplayURL(avatarURL, tempURLMap = {}) {
  const value = String(avatarURL || '').trim();
  if (isWebURL(value)) {
    return value;
  }

  if (isCloudFileID(value)) {
    return tempURLMap[value] || '';
  }

  return '';
}

async function appendAvatarDisplayURLs(data = {}) {
  const list = data.list || [];
  const cloudFileIDs = list
    .map((item) => item.avatar_url)
    .filter(isCloudFileID);
  const tempURLMap = await resolveCloudFileURLs(cloudFileIDs, 3600);

  return {
    ...data,
    list: list.map((item) => ({
      ...item,
      avatar_display_url: getAvatarDisplayURL(item.avatar_url, tempURLMap)
    }))
  };
}

export async function getUsers(params = {}) {
  const data = await callAdminFunction('admin-manage-users', {
    action: 'list',
    ...params
  });
  return appendAvatarDisplayURLs(data);
}

export async function getUserDetail(id) {
  const data = await callAdminFunction('admin-manage-users', {
    action: 'get',
    _id: id
  });
  const avatarDisplayURL = getAvatarDisplayURL(
    data.user?.avatar_url,
    await resolveCloudFileURLs([data.user?.avatar_url], 3600)
  );

  return {
    ...data,
    user: data.user
      ? {
          ...data.user,
          avatar_display_url: avatarDisplayURL
        }
      : data.user
  };
}

export function updateUser(payload) {
  return callAdminFunction('admin-manage-users', {
    action: 'update',
    user: payload
  });
}
