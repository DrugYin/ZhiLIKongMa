import cloudbase from '@cloudbase/js-sdk';

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID || 'zhi-li-kong-ma-7gy2aqcr1add21a7';
const region = import.meta.env.VITE_CLOUDBASE_REGION || 'ap-shanghai';
const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY || '';

const cloudbaseConfig = {
  env: envId,
  region,
  auth: {
    detectSessionInUrl: true
  }
};

if (accessKey) {
  cloudbaseConfig.accessKey = accessKey;
}

export const cloudbaseApp = cloudbase.init(cloudbaseConfig);

export const auth = cloudbaseApp.auth({
  persistence: 'local'
});

export function getCloudbaseEnvId() {
  return envId;
}

export async function getLoginState() {
  return auth.getLoginState();
}

export async function getAuthUser() {
  if (typeof auth.getUser === 'function') {
    const response = await auth.getUser();
    if (response?.error) {
      throw response.error;
    }
    return response?.data?.user || null;
  }

  if (typeof auth.getCurrentUser === 'function') {
    return auth.getCurrentUser();
  }

  return null;
}

export async function signInWithPassword(account, password) {
  const loginAccount = account.trim();
  const payload = {
    password
  };

  if (/^\S+@\S+\.\S+$/.test(loginAccount)) {
    payload.email = loginAccount;
  } else if (/^1[3-9]\d{9}$/.test(loginAccount)) {
    payload.phone = loginAccount;
  } else {
    payload.username = loginAccount;
  }

  const response = await auth.signInWithPassword(payload);
  if (response?.error) {
    throw response.error;
  }

  return response?.data || response;
}

export async function callAdminFunction(name, data = {}) {
  const response = await cloudbaseApp.callFunction({
    name,
    data
  });

  const result = response && response.result ? response.result : response;
  if (!result || result.success === false) {
    throw new Error((result && result.message) || `${name} 调用失败`);
  }

  return result.data || result;
}

const tempFileURLCache = new Map();

export function isCloudFileID(value) {
  return /^cloud:\/\//.test(String(value || '').trim());
}

export function isWebURL(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function normalizeTempFileURLResponse(response) {
  if (Array.isArray(response?.fileList)) {
    return response.fileList;
  }

  if (Array.isArray(response?.data?.fileList)) {
    return response.data.fileList;
  }

  if (Array.isArray(response?.result?.fileList)) {
    return response.result.fileList;
  }

  return [];
}

function getCachedTempFileURL(fileID) {
  const cached = tempFileURLCache.get(fileID);
  if (!cached || cached.expiresAt <= Date.now()) {
    tempFileURLCache.delete(fileID);
    return '';
  }

  return cached.url;
}

export async function resolveCloudFileURLs(fileIDs = [], maxAge = 3600) {
  const result = {};
  const pendingFileIDs = Array.from(new Set(
    fileIDs
      .map((item) => String(item || '').trim())
      .filter(isCloudFileID)
  )).filter((fileID) => {
    const cachedURL = getCachedTempFileURL(fileID);
    if (cachedURL) {
      result[fileID] = cachedURL;
      return false;
    }

    return true;
  });

  if (!pendingFileIDs.length) {
    return result;
  }

  try {
    const response = await cloudbaseApp.getTempFileURL({
      fileList: pendingFileIDs.map((fileID) => ({
        fileID,
        maxAge
      }))
    });
    const fileList = normalizeTempFileURLResponse(response);

    fileList.forEach((item) => {
      const fileID = item.fileID || item.fileId || item.fileid;
      const tempURL = item.tempFileURL || item.tempFileUrl || item.download_url || item.url;
      if (!fileID || !tempURL) {
        return;
      }

      result[fileID] = tempURL;
      tempFileURLCache.set(fileID, {
        url: tempURL,
        expiresAt: Date.now() + Math.max(maxAge - 60, 60) * 1000
      });
    });
  } catch (error) {
    console.warn('[cloud-storage] getTempFileURL failed:', error.message);
  }

  return result;
}

export async function resolveImageURL(value, maxAge = 3600) {
  const url = String(value || '').trim();
  if (!url) {
    return '';
  }

  if (isWebURL(url)) {
    return url;
  }

  if (!isCloudFileID(url)) {
    return '';
  }

  const resolvedMap = await resolveCloudFileURLs([url], maxAge);
  return resolvedMap[url] || '';
}

function normalizeUploadFileResponse(response) {
  return response?.fileID
    || response?.fileId
    || response?.fileid
    || response?.data?.fileID
    || response?.data?.fileId
    || response?.result?.fileID
    || response?.result?.fileId
    || '';
}

export async function uploadCloudFile(file, cloudPath, onUploadProgress) {
  const response = await cloudbaseApp.uploadFile({
    cloudPath,
    filePath: file,
    ...(typeof onUploadProgress === 'function' ? { onUploadProgress } : {})
  });
  const fileID = normalizeUploadFileResponse(response);

  if (!fileID) {
    throw new Error('上传成功但未获取到云存储文件 ID');
  }

  return {
    fileID,
    response
  };
}
