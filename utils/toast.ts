/**
 * Toast 工具类
 * 封装微信原生 toast 和 TDesign message 组件
 */

interface ToastOptions {
  title: string;
  icon?: 'success' | 'error' | 'loading' | 'none';
  duration?: number;
  mask?: boolean;
}

interface ModalOptions {
  title?: string;
  content: string;
  showCancel?: boolean;
  cancelText?: string;
  cancelColor?: string;
  confirmText?: string;
  confirmColor?: string;
}

/**
 * 显示消息提示框
 */
export function showToast(options: ToastOptions | string): Promise<void> {
  const opts: ToastOptions = typeof options === 'string' 
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
export function showSuccess(title: string, duration?: number): Promise<void> {
  return showToast({ title, icon: 'success', duration });
}

/**
 * 显示错误提示
 */
export function showError(title: string, duration?: number): Promise<void> {
  return showToast({ title, icon: 'error', duration });
}

/**
 * 显示加载提示
 */
export function showLoading(title: string = '加载中...', mask: boolean = true): Promise<void> {
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
export function hideLoading(): void {
  wx.hideLoading();
}

/**
 * 显示模态对话框
 */
export function showModal(options: ModalOptions | string): Promise<boolean> {
  const opts: ModalOptions = typeof options === 'string'
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
export function confirm(content: string, title: string = '确认'): Promise<boolean> {
  return showModal({ title, content });
}

/**
 * 警告对话框
 */
export function alert(content: string, title: string = '提示'): Promise<void> {
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

export default {
  showToast,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  showModal,
  confirm,
  alert
};