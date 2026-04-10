function success(message, data) {
  return {
    success: true,
    message,
    data
  }
}

function failure(message, errorCode, extra = {}) {
  return {
    success: false,
    message,
    error_code: errorCode,
    ...extra
  }
}

module.exports = {
  success,
  failure
}
