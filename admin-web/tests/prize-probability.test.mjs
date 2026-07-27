import assert from 'node:assert/strict';

import { formatPercent } from '../src/utils/format.js';

assert.equal(formatPercent(0.0001), '0.01%');
assert.equal(formatPercent(0.00001), '0.001%');
