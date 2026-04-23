import { callAdminFunction } from './cloudbase';

export function getSubmissions(params = {}) {
  return callAdminFunction('admin-manage-submissions', {
    action: 'list',
    ...params
  });
}

export function getSubmissionDetail(submissionId) {
  return callAdminFunction('admin-manage-submissions', {
    action: 'get',
    submission_id: submissionId
  });
}

export function reviewSubmission(payload) {
  return callAdminFunction('admin-manage-submissions', {
    action: 'review',
    submission: payload
  });
}
