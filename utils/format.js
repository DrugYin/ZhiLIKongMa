/**
 * 格式化工具函数
 */

/**
 * 格式化日期
 * @param date 日期对象或时间戳
 * @param format 格式模板，默认 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的日期字符串
 */
function formatDate(date, format) {
  if (format === undefined) {
    format = 'YYYY-MM-DD HH:mm:ss';
  }
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  const pad = function (n) {
    return n.toString().padStart(2, '0');
  };

  return format
    .replace('YYYY', year.toString())
    .replace('MM', pad(month))
    .replace('DD', pad(day))
    .replace('HH', pad(hours))
    .replace('mm', pad(minutes))
    .replace('ss', pad(seconds));
}

/**
 * 格式化相对时间
 * @param date 日期对象或时间戳
 * @returns 相对时间字符串
 */
function formatRelativeTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚刚';
  }
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  if (hours < 24) {
    return `${hours}小时前`;
  }
  if (days < 7) {
    return `${days}天前`;
  }
  return formatDate(d, 'YYYY-MM-DD');
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化手机号（隐藏中间4位）
 * @param phone 手机号
 * @returns 格式化后的手机号
 */
function formatPhone(phone) {
  if (!phone || phone.length !== 11) {
    return phone;
  }
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/**
 * 格式化身份证号（隐藏中间部分）
 * @param idCard 身份证号
 * @returns 格式化后的身份证号
 */
function formatIdCard(idCard) {
  if (!idCard || idCard.length < 10) {
    return idCard;
  }
  const start = idCard.substring(0, 4);
  const end = idCard.substring(idCard.length - 4);
  return `${start}**********${end}`;
}

/**
 * 格式化金额
 * @param amount 金额
 * @param decimals 小数位数，默认2
 * @returns 格式化后的金额
 */
function formatMoney(amount, decimals) {
  if (decimals === undefined) {
    decimals = 2;
  }
  return amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化数字（添加千分位）
 * @param num 数字
 * @returns 格式化后的数字
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化时间戳为倒计时
 * @param seconds 秒数
 * @returns 格式化后的倒计时
 */
function formatCountdown(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = function (n) {
    return n.toString().padStart(2, '0');
  };

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

module.exports = {
  formatDate,
  formatRelativeTime,
  formatFileSize,
  formatPhone,
  formatIdCard,
  formatMoney,
  formatNumber,
  formatCountdown
};
