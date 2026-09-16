import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  getMessageTypeLabel,
  getSendStatusLabel,
  getErrorCodeLabel
} from '../src/constants/subscribe-message.js';

assert.equal(getMessageTypeLabel('task_published'), '作业通知');
assert.equal(getMessageTypeLabel('task_submitted'), '作业提交提醒');
assert.equal(getMessageTypeLabel('submission_reviewed'), '作业批改完成通知');
assert.equal(getSendStatusLabel('failed'), '发送失败');
assert.equal(getErrorCodeLabel(43101), '用户无可用订阅次数');
assert.equal(getErrorCodeLabel(99999), '其他错误（99999）');

const routerSource = fs.readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8');
const layoutSource = fs.readFileSync(new URL('../src/layouts/AdminLayout.vue', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../src/api/subscribe-messages.js', import.meta.url), 'utf8');

assert.match(routerSource, /path: 'subscribe-messages'/);
assert.match(layoutSource, /消息统计/);
assert.match(apiSource, /admin-manage-subscribe-messages/);
