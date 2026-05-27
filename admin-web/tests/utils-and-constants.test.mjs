import assert from 'node:assert/strict';

import { formatDateTime, formatPercent } from '../src/utils/format.js';
import {
  PRIZE_STATUS_OPTIONS,
  PRIZE_TYPE_OPTIONS,
  getPrizeStatusLabel,
  getPrizeTypeLabel
} from '../src/constants/prize.js';

assert.equal(formatDateTime('2026-05-27T07:08:09.000Z'), '2026-05-27 15:08:09');
assert.equal(formatDateTime(null), '--');
assert.equal(formatPercent(0.125), '12.5%');
assert.equal(formatPercent(1), '100.0%');
assert.equal(formatPercent(null), '--');

assert.deepEqual(PRIZE_TYPE_OPTIONS.map((item) => item.value), ['physical', 'virtual', 'points']);
assert.equal(getPrizeTypeLabel('physical'), '实物奖品');
assert.equal(getPrizeTypeLabel('missing'), 'missing');
assert.deepEqual(PRIZE_STATUS_OPTIONS.map((item) => item.value), ['active', 'disabled']);
assert.equal(getPrizeStatusLabel('disabled'), '下架');
