export const MESSAGE_TYPE_OPTIONS = [
  { value: 'task_published', label: '作业通知' },
  { value: 'task_submitted', label: '作业提交提醒' },
  { value: 'submission_reviewed', label: '作业批改完成通知' }
];

export function getMessageTypeLabel(value) {
  return MESSAGE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || '--';
}

export function getSendStatusLabel(value) {
  return { success: '发送成功', failed: '发送失败' }[value] || value || '--';
}

export function getErrorCodeLabel(value) {
  const code = Number(value || 0);
  const labels = {
    43101: '用户无可用订阅次数',
    47003: '模板字段不符合要求',
    41030: '消息跳转路径无效'
  };
  return labels[code] || `其他错误（${code}）`;
}
