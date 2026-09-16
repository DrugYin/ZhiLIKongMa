const TEMPLATE_IDS = Object.freeze({
  TASK_SUBMITTED: 'HO4rLQjLFnID1yBejQB7v-zm2QIRbNIlFci5EeMvmnI',
  TASK_PUBLISHED: '-YZw9XHRKIlte5uQ20dO4lRuaXGFI4gPM_2Z_isBpbo',
  SUBMISSION_REVIEWED: 'WToHJbW9SD8z86AlvCQMMkigfpzIL4AtWtMhVd7gr7w'
})

function getUnavailableResult() {
  return {
    success: false,
    unavailable: true,
    accepted: [],
    rejected: [],
    statuses: {}
  }
}

function normalizeTemplateIds(templateIds) {
  return Array.from(new Set(
    (Array.isArray(templateIds) ? templateIds : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )).slice(0, 3)
}

function requestSubscribeMessages(templateIds, api) {
  const wxApi = api || (typeof wx !== 'undefined' ? wx : null)
  const ids = normalizeTemplateIds(templateIds)

  if (!ids.length || !wxApi || typeof wxApi.requestSubscribeMessage !== 'function') {
    return Promise.resolve(getUnavailableResult())
  }

  return new Promise((resolve) => {
    try {
      wxApi.requestSubscribeMessage({
        tmplIds: ids,
        success(res = {}) {
          const statuses = ids.reduce((result, id) => {
            result[id] = String(res[id] || '')
            return result
          }, {})
          const accepted = ids.filter((id) => ['accept', 'acceptWithAudio'].includes(statuses[id]))

          resolve({
            success: true,
            unavailable: false,
            accepted,
            rejected: ids.filter((id) => !accepted.includes(id)),
            statuses
          })
        },
        fail(error = {}) {
          resolve({
            success: false,
            unavailable: false,
            accepted: [],
            rejected: [],
            statuses: {},
            errorCode: Number(error.errCode || 0),
            errorMessage: String(error.errMsg || error.message || '')
          })
        }
      })
    } catch (error) {
      resolve({
        success: false,
        unavailable: false,
        accepted: [],
        rejected: [],
        statuses: {},
        errorCode: Number(error && error.errCode || 0),
        errorMessage: String(error && (error.errMsg || error.message) || '')
      })
    }
  })
}

function requestTeacherSubmissionReminder(api) {
  return requestSubscribeMessages([TEMPLATE_IDS.TASK_SUBMITTED], api)
}

function requestStudentTaskNotifications(api) {
  return requestSubscribeMessages([
    TEMPLATE_IDS.TASK_PUBLISHED,
    TEMPLATE_IDS.SUBMISSION_REVIEWED
  ], api)
}

module.exports = {
  TEMPLATE_IDS,
  requestSubscribeMessages,
  requestTeacherSubmissionReminder,
  requestStudentTaskNotifications
}
