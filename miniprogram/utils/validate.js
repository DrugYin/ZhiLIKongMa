/**
 * 验证工具函数
 */

/**
 * 验证手机号
 * @param phone 手机号
 * @returns 是否有效
 */
function isValidPhone(phone) {
  const reg = /^1[3-9]\d{9}$/;
  return reg.test(phone);
}

/**
 * 验证邮箱
 * @param email 邮箱
 * @returns 是否有效
 */
function isValidEmail(email) {
  const reg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return reg.test(email);
}

/**
 * 验证身份证号（18位）
 * @param idCard 身份证号
 * @returns 是否有效
 */
function isValidIdCard(idCard) {
  const reg = /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
  return reg.test(idCard);
}

/**
 * 验证密码强度
 * @param password 密码
 * @returns 强度等级：0-弱，1-中，2-强
 */
function getPasswordStrength(password) {
  if (!password || password.length < 6) {
    return 0;
  }

  let strength = 0;

  // 长度大于8
  if (password.length >= 8) {
    strength++;
  }

  // 包含数字
  if (/\d/.test(password)) {
    strength++;
  }

  // 包含小写字母
  if (/[a-z]/.test(password)) {
    strength++;
  }

  // 包含大写字母
  if (/[A-Z]/.test(password)) {
    strength++;
  }

  // 包含特殊字符
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    strength++;
  }

  if (strength <= 2) {
    return 0; // 弱
  }
  if (strength <= 4) {
    return 1; // 中
  }
  return 2; // 强
}

/**
 * 验证密码是否符合要求
 * @param password 密码
 * @param minLength 最小长度，默认6
 * @returns 是否有效
 */
function isValidPassword(password, minLength) {
  if (minLength === undefined) {
    minLength = 6;
  }
  return password.length >= minLength;
}

/**
 * 验证用户名
 * @param username 用户名
 * @param minLength 最小长度，默认2
 * @param maxLength 最大长度，默认20
 * @returns 是否有效
 */
function isValidUsername(username, minLength, maxLength) {
  if (!username) {
    return false;
  }
  if (minLength === undefined) {
    minLength = 2;
  }
  if (maxLength === undefined) {
    maxLength = 20;
  }
  const trimmed = username.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
}

/**
 * 验证昵称
 * @param nickname 昵称
 * @param minLength 最小长度，默认2
 * @param maxLength 最大长度，默认20
 * @returns 是否有效
 */
function isValidNickname(nickname, minLength, maxLength) {
  return isValidUsername(nickname, minLength, maxLength);
}

/**
 * 验证是否为空
 * @param value 值
 * @returns 是否为空
 */
function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * 验证URL
 * @param url URL地址
 * @returns 是否有效
 */
function isValidUrl(url) {
  const reg = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  return reg.test(url);
}

/**
 * 验证是否为数字
 * @param value 值
 * @returns 是否为数字
 */
function isNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * 验证数字范围
 * @param value 数字
 * @param min 最小值
 * @param max 最大值
 * @returns 是否在范围内
 */
function isInRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * 验证银行卡号
 * @param cardNo 银行卡号
 * @returns 是否有效
 */
function isValidBankCard(cardNo) {
  const reg = /^[1-9]\d{15,18}$/;
  return reg.test(cardNo.replace(/\s/g, ''));
}

/**
 * 验证中文姓名
 * @param name 姓名
 * @returns 是否有效
 */
function isValidChineseName(name) {
  const reg = /^[\u4e00-\u9fa5]{2,20}$/;
  return reg.test(name);
}

module.exports = {
  isValidPhone,
  isValidEmail,
  isValidIdCard,
  getPasswordStrength,
  isValidPassword,
  isValidUsername,
  isValidNickname,
  isEmpty,
  isValidUrl,
  isNumber,
  isInRange,
  isValidBankCard,
  isValidChineseName
};
