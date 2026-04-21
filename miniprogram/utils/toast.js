/**
 * Toast 工具类
 * 封装微信原生 toast 和 TDesign message 组件
 */

/**
 * 显示消息提示框
 */
function showToast(options) {
  const opts = typeof options === 'string' 
    ? { title: options, icon: 'none' }
    : { icon: 'none', ...options };

  return new Promise((resolve, reject) => {
    wx.showToast({
      title: opts.title,
      icon: opts.icon || 'none',
      duration: opts.duration || 2000,
      mask: opts.mask || false,
      success: () => resolve(),
      fail: (err) => reject(err)
    });
  });
}

/**
 * 显示成功提示
 */
function showSuccess(title, duration) {
  return showToast({ title, icon: 'success', duration });
}

/**
 * 显示错误提示
 */
function showError(title, duration) {
  return showToast({ title, icon: 'error', duration });
}

/**
 * 显示加载提示
 */
function showLoading(title, mask) {
  if (title === undefined) {
    title = '加载中...';
  }
  if (mask === undefined) {
    mask = true;
  }
  return new Promise((resolve, reject) => {
    wx.showLoading({
      title,
      mask,
      success: () => resolve(),
      fail: (err) => reject(err)
    });
  });
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示模态对话框
 */
function showModal(options) {
  const opts = typeof options === 'string'
    ? { content: options }
    : options;

  return new Promise((resolve, reject) => {
    wx.showModal({
      title: opts.title || '提示',
      content: opts.content,
      showCancel: opts.showCancel !== false,
      cancelText: opts.cancelText || '取消',
      cancelColor: opts.cancelColor || '#000000',
      confirmText: opts.confirmText || '确定',
      confirmColor: opts.confirmColor || '#576B95',
      success: (res) => {
        resolve(res.confirm);
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 确认对话框
 */
function confirm(content, title) {
  if (title === undefined) {
    title = '确认';
  }
  return showModal({ title, content });
}

/**
 * 警告对话框
 */
function alert(content, title) {
  if (title === undefined) {
    title = '提示';
  }
  return new Promise((resolve, reject) => {
    wx.showModal({
      title,
      content,
      showCancel: false,
      success: () => resolve(),
      fail: (err) => reject(err)
    });
  });
}

module.exports = {
  showToast,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  showModal,
  confirm,
  alert
};
