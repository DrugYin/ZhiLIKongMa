import assert from 'node:assert/strict';

import { useTablePage } from '../src/composables/useTablePage.js';

const calls = [];
const table = useTablePage({
  initialFilters: {
    keyword: '',
    status: ''
  },
  async request({ filters, pagination }) {
    calls.push({
      filters: { ...filters },
      pagination: { ...pagination }
    });
    return {
      list: [{ id: calls.length }],
      total: 35
    };
  }
});

assert.equal(table.loading.value, false);

await table.loadData();
assert.equal(table.loading.value, false);
assert.deepEqual(table.list.value, [{ id: 1 }]);
assert.equal(table.pagination.total, 35);
assert.equal(calls[0].pagination.page, 1);
assert.equal(calls[0].pagination.page_size, 20);

table.filters.keyword = 'abc';
table.pagination.current = 3;
await table.handleSearch();
assert.equal(table.pagination.current, 1);
assert.equal(calls[1].filters.keyword, 'abc');

await table.handlePageChange({ current: 2, pageSize: 50 });
assert.equal(table.pagination.current, 2);
assert.equal(table.pagination.pageSize, 50);
assert.equal(calls[2].pagination.page, 2);
assert.equal(calls[2].pagination.page_size, 50);
