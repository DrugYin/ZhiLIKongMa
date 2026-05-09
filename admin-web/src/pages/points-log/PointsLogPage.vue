<template>
  <div class="points-log-page">
    <t-card title="积分明细" :bordered="false">
      <!-- 筛选条件 -->
      <div class="filter-bar">
        <t-input
          v-model="filters.keyword"
          placeholder="搜索用户名/备注"
          clearable
          style="width: 200px"
          @change="handleSearch"
        />
        <t-select
          v-model="filters.type"
          placeholder="变动类型"
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <t-option value="income" label="收入" />
          <t-option value="expense" label="支出" />
        </t-select>
        <t-select
          v-model="filters.source"
          placeholder="来源"
          clearable
          style="width: 150px"
          @change="handleSearch"
        >
          <t-option value="register_gift" label="注册赠送" />
          <t-option value="task_reward" label="任务奖励" />
          <t-option value="admin_grant" label="管理员发放" />
          <t-option value="admin_deduct" label="管理员扣除" />
          <t-option value="admin_adjust" label="积分调整" />
          <t-option value="lottery_cost" label="抽奖消耗" />
          <t-option value="rollback" label="积分回滚" />
        </t-select>
        <t-date-range-picker
          v-model="filters.dateRange"
          placeholder="选择日期范围"
          style="width: 240px"
          @change="handleSearch"
        />
        <t-button theme="primary" @click="handleSearch">查询</t-button>
        <t-button theme="default" @click="handleReset">重置</t-button>
      </div>

      <!-- 数据表格 -->
      <t-table
        :data="tableData"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        row-key="_id"
        @page-change="handlePageChange"
      >
        <template #type="{ row }">
          <t-tag :theme="row.type === 'income' ? 'success' : 'danger'" variant="light">
            {{ row.type === 'income' ? '收入' : '支出' }}
          </t-tag>
        </template>
        <template #amount="{ row }">
          <span :class="row.type === 'income' ? 'amount-income' : 'amount-expense'">
            {{ row.type === 'income' ? '+' : '-' }}{{ row.amount }}
          </span>
        </template>
        <template #user_openid="{ row }">
          <div class="cell-with-sub">
            <span class="cell-main">{{ row.user_name || '--' }}</span>
            <span class="cell-sub">{{ row.user_openid }}</span>
          </div>
        </template>
        <template #operator_openid="{ row }">
          <div class="cell-with-sub">
            <span class="cell-main">{{ row.operator_name || '--' }}</span>
            <span class="cell-sub">{{ row.operator_openid }}</span>
          </div>
        </template>
        <template #source="{ row }">
          {{ getSourceText(row.source) }}
        </template>
        <template #create_time="{ row }">
          {{ formatTime(row.create_time) }}
        </template>
      </t-table>
    </t-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { callAdminFunction } from '@/api/cloudbase';

const loading = ref(false);
const tableData = ref([]);
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
});

const filters = reactive({
  keyword: '',
  type: '',
  source: '',
  dateRange: []
});

const columns = [
  { colKey: 'user_openid', title: '用户', width: 200, cell: 'user_openid' },
  { colKey: 'type', title: '类型', width: 80, cell: 'type' },
  { colKey: 'amount', title: '积分', width: 100, cell: 'amount' },
  { colKey: 'before_points', title: '变动前', width: 100 },
  { colKey: 'after_points', title: '变动后', width: 100 },
  { colKey: 'source', title: '来源', width: 120, cell: 'source' },
  { colKey: 'remark', title: '备注', width: 200, ellipsis: true },
  { colKey: 'operator_openid', title: '操作人', width: 180, cell: 'operator_openid' },
  { colKey: 'create_time', title: '时间', width: 150, cell: 'create_time' }
];

const sourceMap = {
  register_gift: '注册赠送',
  task_reward: '任务奖励',
  admin_grant: '管理员发放',
  admin_deduct: '管理员扣除',
  admin_adjust: '积分调整',
  lottery_cost: '抽奖消耗',
  rollback: '积分回滚'
};

function getSourceText(source) {
  return sourceMap[source] || source;
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

async function loadData() {
  loading.value = true;
  try {
    const params = {
      page: pagination.current,
      page_size: pagination.pageSize
    };

    if (filters.keyword) {
      params.keyword = filters.keyword;
    }
    if (filters.type) {
      params.type = filters.type;
    }
    if (filters.source) {
      params.source = filters.source;
    }
    if (filters.dateRange && filters.dateRange.length === 2) {
      params.start_time = filters.dateRange[0];
      params.end_time = filters.dateRange[1];
    }

    const res = await callAdminFunction('get-points-log', params);
    tableData.value = res.list || [];
    pagination.total = res.total || 0;
  } catch (err) {
    console.error('加载积分明细失败:', err);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.current = 1;
  loadData();
}

function handleReset() {
  filters.keyword = '';
  filters.type = '';
  filters.source = '';
  filters.dateRange = [];
  pagination.current = 1;
  loadData();
}

function handlePageChange(pageInfo) {
  pagination.current = pageInfo.current;
  pagination.pageSize = pageInfo.pageSize;
  loadData();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.points-log-page {
  padding: 16px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.amount-income {
  color: #52c41a;
  font-weight: bold;
}

.amount-expense {
  color: #ff4d4f;
  font-weight: bold;
}

.cell-with-sub {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cell-main {
  color: #333;
  font-size: 14px;
}

.cell-sub {
  color: #999;
  font-size: 12px;
}
</style>
