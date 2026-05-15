<template>
  <section>
    <PageHeader
      eyebrow="Lottery"
      title="抽奖记录管理"
      description="查看所有学生的抽奖记录，支持按兑奖状态筛选，对未兑奖记录执行人工兑奖操作。"
    >
      <template #actions>
        <t-button variant="outline" :loading="loading" @click="loadRecords">刷新</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false" class="records-card">
      <div class="records-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索学生姓名、奖品名称或兑奖码"
          class="records-search"
          @enter="loadRecords"
          @clear="loadRecords"
        />
        <t-select
          v-model="filters.isRedeemed"
          clearable
          placeholder="全部兑奖状态"
          class="records-redeemed"
          @change="loadRecords"
          @clear="loadRecords"
        >
          <t-option label="已兑奖" value="true" />
          <t-option label="未兑奖" value="false" />
        </t-select>
        <t-button :loading="loading" @click="loadRecords">查询</t-button>
      </div>

      <t-table
        row-key="_id"
        :data="recordRows"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        hover
      >
        <template #is_redeemed="{ row }">
          <t-tag :theme="row.is_redeemed ? 'success' : 'warning'" variant="light">
            {{ row.is_redeemed ? '已兑奖' : '未兑奖' }}
          </t-tag>
        </template>

        <template #redeem_id="{ row }">
          <code v-if="row.redeem_id" class="redeem-code">{{ row.redeem_id }}</code>
          <span v-else class="redeem-empty">--</span>
        </template>

        <template #prize_type="{ row }">
          <t-tag variant="light">{{ getTypeLabel(row.prize_type) }}</t-tag>
        </template>

        <template #redeem_time="{ row }">
          {{ formatDateTime(row.redeem_time) || '--' }}
        </template>

        <template #create_time="{ row }">
          {{ formatDateTime(row.create_time) }}
        </template>

        <template #op="{ row }">
          <t-space>
            <t-popconfirm
              v-if="!row.is_redeemed"
              content="确认标记该记录为已兑奖？"
              @confirm="handleRedeem(row)"
            >
              <t-button size="small" theme="primary" variant="text">兑奖</t-button>
            </t-popconfirm>
            <span v-else class="op-done">已完成</span>
          </t-space>
        </template>
      </t-table>
    </t-card>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { getDrawRecordList, redeemDrawRecord } from '@/api/draw-records';

const typeOptions = [
  { label: '实物', value: 'physical' },
  { label: '虚拟', value: 'virtual' },
  { label: '积分', value: 'points' }
];

const columns = [
  { colKey: 'student_name', title: '学生', width: 120, ellipsis: true },
  { colKey: 'prize_name', title: '奖品名称', width: 160, ellipsis: true },
  { colKey: 'prize_type', title: '类型', width: 80 },
  { colKey: 'points_cost', title: '消耗积分', width: 90 },
  { colKey: 'prize_value', title: '奖品价值', width: 90 },
  { colKey: 'is_redeemed', title: '兑奖状态', width: 90 },
  { colKey: 'redeem_id', title: '兑奖码', width: 110 },
  { colKey: 'redeem_time', title: '兑奖时间', width: 170 },
  { colKey: 'create_time', title: '抽奖时间', width: 170 },
  { colKey: 'op', title: '操作', width: 90, fixed: 'right' }
];

const loading = ref(false);
const recordRows = ref([]);
const filters = reactive({
  keyword: '',
  isRedeemed: ''
});

const pagination = computed(() => ({
  defaultPageSize: 15,
  showJumper: true,
  total: recordRows.value.length
}));

function getTypeLabel(type) {
  return typeOptions.find((item) => item.value === type)?.label || type || '--';
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { hour12: false });
}

async function loadRecords() {
  loading.value = true;
  try {
    const data = await getDrawRecordList({
      keyword: filters.keyword.trim(),
      is_redeemed: filters.isRedeemed
    });
    recordRows.value = data.list || [];
  } catch (error) {
    MessagePlugin.error(error.message || '抽奖记录加载失败');
  } finally {
    loading.value = false;
  }
}

async function handleRedeem(row) {
  loading.value = true;
  try {
    await redeemDrawRecord(row._id);
    MessagePlugin.success('兑奖成功');
    await loadRecords();
  } catch (error) {
    MessagePlugin.error(error.message || '兑奖操作失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadRecords);
</script>

<style scoped>
.records-card {
  margin-top: 16px;
}

.records-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.records-search {
  width: 300px;
}

.records-redeemed {
  width: 140px;
}

.redeem-code {
  font-family: monospace;
  font-size: 12px;
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.redeem-empty {
  color: #ccc;
}

.op-done {
  color: #999;
  font-size: 13px;
}
</style>
