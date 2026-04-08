function getTempUrlMap(fileIds = []) {
  const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)))
  if (!uniqueFileIds.length) {
    return Promise.resolve({})
  }

  return new Promise((resolve, reject) => {
    wx.cloud.getTempFileURL({
      fileList: uniqueFileIds,
      success: (res) => {
        const fileList = Array.isArray(res.fileList) ? res.fileList : []
        const map = fileList.reduce((result, item) => {
          if (item && item.fileID) {
            result[item.fileID] = item.tempFileURL || item.fileID
          }
          return result
        }, {})
        resolve(map)
      },
      fail: reject
    })
  }).catch((error) => {
    console.error('[file-resource] getTempUrlMap error:', error)
    return uniqueFileIds.reduce((result, fileId) => {
      result[fileId] = fileId
      return result
    }, {})
  })
}

function getFileExtension(filePath = '') {
  const value = String(filePath || '')
  const index = value.lastIndexOf('.')
  if (index < 0) {
    return ''
  }

  return value.slice(index)
}

function getFileNameFromPath(filePath = '') {
  const value = String(filePath || '')
  const parts = value.split(/[\\/]/)
  return parts[parts.length - 1] || ''
}

function formatFileSize(size) {
  const value = Number(size || 0)
  if (!value) {
    return '未知大小'
  }

  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

async function buildImagePreviewData(imageIds = []) {
  const validIds = Array.isArray(imageIds) ? imageIds.filter(Boolean) : []
  if (!validIds.length) {
    return {
      imageList: [],
      previewUrls: []
    }
  }

  const tempUrlMap = await getTempUrlMap(validIds)
  const imageList = validIds.map((fileId, index) => ({
    fileId,
    url: tempUrlMap[fileId] || fileId,
    name: `任务图片${index + 1}`
  }))

  return {
    imageList,
    previewUrls: imageList.map((item) => item.url).filter(Boolean)
  }
}

async function buildAttachmentPreviewFiles(fileEntries = []) {
  const validEntries = Array.isArray(fileEntries)
    ? fileEntries.filter((item) => item && item.file_id)
    : []

  if (!validEntries.length) {
    return []
  }

  const tempUrlMap = await getTempUrlMap(validEntries.map((item) => item.file_id))
  return validEntries.map((item) => ({
    url: tempUrlMap[item.file_id] || item.file_id,
    name: item.file_name || getFileNameFromPath(item.file_id),
    percent: 100,
    status: 'done',
    file_id: item.file_id,
    size: Number(item.file_size || 0),
    sizeText: formatFileSize(item.file_size),
    file_name: item.file_name || getFileNameFromPath(item.file_id)
  }))
}

function downloadCloudFile(fileId) {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID: fileId,
      success: resolve,
      fail: reject
    })
  })
}

function downloadHttpFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            tempFilePath: res.tempFilePath
          })
          return
        }

        reject(new Error(`download failed: ${res.statusCode}`))
      },
      fail: reject
    })
  })
}

async function resolvePreviewFilePath(file = {}) {
  if (file.localPath) {
    return {
      filePath: file.localPath,
      localPath: file.localPath
    }
  }

  if (file.url && !/^https?:\/\//i.test(file.url) && !/^cloud:\/\//i.test(file.url)) {
    return {
      filePath: file.url,
      localPath: file.url
    }
  }

  if (file.file_id) {
    const result = await downloadCloudFile(file.file_id)
    return {
      filePath: result.tempFilePath,
      localPath: result.tempFilePath
    }
  }

  if (file.url && /^https?:\/\//i.test(file.url)) {
    const result = await downloadHttpFile(file.url)
    return {
      filePath: result.tempFilePath,
      localPath: result.tempFilePath
    }
  }

  throw new Error('无可用预览地址')
}

function openDocument(filePath) {
  return new Promise((resolve, reject) => {
    wx.openDocument({
      filePath,
      showMenu: true,
      success: resolve,
      fail: reject
    })
  })
}

function previewImages(urls = [], currentIndex = 0) {
  const previewUrls = Array.isArray(urls) ? urls.filter(Boolean) : []
  if (!previewUrls.length) {
    return
  }

  const current = previewUrls[Number(currentIndex)] || previewUrls[0]
  wx.previewImage({
    urls: previewUrls,
    current
  })
}

function updateFileLocalPath(fileList = [], file = {}, localPath = '') {
  const targetUploadId = file._uploadId
  const targetFileId = file.file_id

  return fileList.map((item) => {
    if ((targetUploadId && item._uploadId === targetUploadId) || (targetFileId && item.file_id === targetFileId)) {
      return {
        ...item,
        localPath
      }
    }

    return item
  })
}

module.exports = {
  getTempUrlMap,
  getFileExtension,
  getFileNameFromPath,
  formatFileSize,
  buildImagePreviewData,
  buildAttachmentPreviewFiles,
  resolvePreviewFilePath,
  openDocument,
  previewImages,
  updateFileLocalPath
}
