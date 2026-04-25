<template>
  <section>
    <PageHeader
      eyebrow="Rankings"
      title="排行榜"
      description="查看当前周榜、月榜、总榜快照，并追溯已保存的周榜与月榜历史数据。"
    >
      <template #actions>
        <t-button variant="outline" :loading="refreshing" @click="refreshActiveTab">刷新</t-button>
      </template>
    </PageHeader>

    <t-tabs v-model="activeTab" class="ranking-tabs" @change="handleTabChange">
      <t-tab-panel value="current" label="当前排行榜">
        <div class="ranking-stat-grid">
          <t-card :bordered="false" class="ranking-stat-card">
            <span>排行榜类型</span>
            <strong>{{ getRankTypeLabel(currentRankType) }}</strong>
            <em>{{ getCurrentPeriodText(currentSnapshot) }}</em>
          </t-card>
          <t-card :bordered="false" class="ranking-stat-card">
            <span>上榜人数</span>
            <strong>{{ formatNumber(currentSnapshot?.participant_count, '0') }}</strong>
            <em>积分大于 0 的学生</em>
          </t-card>
          <t-card :bordered="false" class="ranking-stat-card">
            <span>榜首积分</span>
            <strong>{{ formatNumber(currentSnapshot?.top_three?.[0]?.points, '0') }}</strong>
            <em>{{ currentSnapshot?.top_three?.[0]?.name || '暂无榜首' }}</em>
          </t-card>
          <t-card :bordered="false" class="ranking-stat-card">
            <span>快照时间</span>
            <strong>{{ formatDateTime(currentSnapshot?.generated_at) }}</strong>
            <em>{{ currentSnapshot ? '当前缓存数据' : '暂无快照' }}</em>
          </t-card>
        </div>

        <t-card :bordered="false" class="config-card ranking-card">
          <div class="config-toolbar ranking-toolbar">
            <t-select
              v-model="currentRankType"
              class="ranking-filter"
              placeholder="排行榜类型"
              @change="loadCurrentRanking"
            >
              <t-option v-for="item in currentRankOptions" :key="item.value" :label="item.label" :value="item.value" />
            </t-select>
            <t-button :loading="currentLoading" @click="loadCurrentRanking">查询</t-button>
          </div>

          <div class="ranking-top-three">
            <div
              v-for="item in normalizedCurrentTopThree"
              :key="item.rank"
              class="ranking-podium"
            >
              <span>第 {{ item.rank }} 名</span>
              <strong>{{ item.name }}</strong>
              <em>{{ formatNumber(item.points, '0') }} 分</em>
            </div>
          </div>

          <div class="ranking-table-shell">
            <t-table
              row-key="_openid"
              class="ranking-table"
              :data="currentRows"
              :columns="rankingColumns"
              :loading="currentLoading"
              :pagination="rankingPagination"
              hover
            >
              <template #rank="{ row }">
                <t-tag :theme="getRankTheme(row.rank)" variant="light">第 {{ row.rank }} 名</t-tag>
              </template>

              <template #student="{ row }">
                <div class="ranking-student-cell">
                  <strong>{{ row.name || '--' }}</strong>
                  <span>{{ row.grade || '待完善' }} · {{ row._openid || '--' }}</span>
                </div>
              </template>

              <template #points="{ row }">
                <strong>{{ formatNumber(row.points, '0') }}</strong>
              </template>

              <template #task_count="{ row }">
                {{ currentRankType === 'total' ? '--' : formatNumber(row.task_count, '0') }}
              </template>

              <template #total_points="{ row }">
                {{ formatNumber(row.total_points, '0') }}
              </template>

              <template #trend_text="{ row }">
                {{ row.trend_text || '--' }}
              </template>
            </t-table>
          </div>
        </t-card>
      </t-tab-panel>

      <t-tab-panel value="history" label="历史排行榜">
        <t-card :bordered="false" class="config-card ranking-card">
          <div class="config-toolbar ranking-toolbar">
            <t-select
              v-model="historyFilters.rankType"
              clearable
              class="ranking-filter"
              placeholder="全部周期类型"
              @change="handleHistorySearch"
              @clear="handleHistorySearch"
            >
              <t-option label="周榜" value="week" />
              <t-option label="月榜" value="month" />
            </t-select>
            <t-button :loading="historyLoading" @click="handleHistorySearch">查询</t-button>
          </div>

          <div class="ranking-table-shell">
            <t-table
              row-key="_id"
              class="ranking-history-table"
              :data="historyRows"
              :columns="historyColumns"
              :loading="historyLoading"
              :pagination="historyPagination"
              hover
              @page-change="handleHistoryPageChange"
            >
              <template #rank_type="{ row }">
                <t-tag theme="primary" variant="light">{{ getRankTypeLabel(row.rank_type) }}</t-tag>
              </template>

              <template #period="{ row }">
                <div class="ranking-student-cell">
                  <strong>{{ getPeriodText(row) }}</strong>
                  <span>{{ row.period_key || row._id }}</span>
                </div>
              </template>

              <template #top_three="{ row }">
                <span>{{ getTopThreeText(row.top_three) }}</span>
              </template>

              <template #participant_count="{ row }">
                {{ formatNumber(row.participant_count, '0') }}
              </template>

              <template #generated_at="{ row }">
                {{ formatDateTime(row.generated_at) }}
              </template>

              <template #op="{ row }">
                <t-button size="small" variant="text" @click="openHistoryDetail(row)">查看榜单</t-button>
              </template>
            </t-table>
          </div>
        </t-card>
      </t-tab-panel>
    </t-tabs>

    <t-dialog
      v-model:visible="historyDetailVisible"
      header="历史排行榜详情"
      width="980px"
      :footer="false"
    >
      <div v-if="historyDetailSnapshot" class="ranking-detail">
        <div class="ranking-detail-summary">
          <div>
            <span>类型</span>
            <strong>{{ getRankTypeLabel(historyDetailSnapshot.rank_type) }}</strong>
          </div>
          <div>
            <span>周期</span>
            <strong>{{ getPeriodText(historyDetailSnapshot) }}</strong>
          </div>
          <div>
            <span>上榜人数</span>
            <strong>{{ formatNumber(historyDetailSnapshot.participant_count, '0') }}</strong>
          </div>
          <div>
            <span>生成时间</span>
            <strong>{{ formatDateTime(historyDetailSnapshot.generated_at) }}</strong>
          </div>
        </div>

        <div class="ranking-table-shell">
          <t-table
            row-key="_openid"
            class="ranking-table"
            :data="historyDetailRows"
            :columns="rankingColumns"
            :loading="historyDetailLoading"
            :pagination="historyDetailPagination"
            hover
          >
            <template #rank="{ row }">
              <t-tag :theme="getRankTheme(row.rank)" variant="light">第 {{ row.rank }} 名</t-tag>
            </template>

            <template #student="{ row }">
              <div class="ranking-student-cell">
                <strong>{{ row.name || '--' }}</strong>
                <span>{{ row.grade || '待完善' }} · {{ row._openid || '--' }}</span>
              </div>
            </template>

            <template #points="{ row }">
              <strong>{{ formatNumber(row.points, '0') }}</strong>
            </template>

            <template #task_count="{ row }">
              {{ formatNumber(row.task_count, '0') }}
            </template>

            <template #total_points="{ row }">
              {{ formatNumber(row.total_points, '0') }}
            </template>

            <template #trend_text="{ row }">
              {{ row.trend_text || '--' }}
            </template>
          </t-table>
        </div>
      </div>
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { getCurrentRanking, getRankingHistory, getRankingHistoryDetail } from '@/api/rankings';
import { formatNumber } from '@/utils/format';

const activeTab = ref('current');
const currentRankType = ref('week');
const currentSnapshot = ref(null);
const currentLoading = ref(false);
const historyLoading = ref(false);
const historyDetailLoading = ref(false);
const historyDetailVisible = ref(false);
const historyDetailSnapshot = ref(null);
const historyRows = ref([]);
const historyTotal = ref(0);
const historyFilters = reactive({
  rankType: '',
  page: 1,
  pageSize: 10
});

const currentRankOptions = [
  { label: '周榜', value: 'week' },
  { label: '月榜', value: 'month' },
  { label: '总榜', value: 'total' }
];

const rankingColumns = [
  { colKey: 'rank', title: '排名', width: 100 },
  { colKey: 'student', title: '学生', minWidth: 260 },
  { colKey: 'points', title: '本榜积分', width: 120, align: 'right' },
  { colKey: 'task_count', title: '任务数', width: 100, align: 'right' },
  { colKey: 'total_points', title: '累计积分', width: 120, align: 'right' },
  { colKey: 'trend_text', title: '状态', width: 160 }
];

const historyColumns = [
  { colKey: 'rank_type', title: '类型', width: 100 },
  { colKey: 'period', title: '统计周期', minWidth: 220 },
  { colKey: 'participant_count', title: '上榜人数', width: 110, align: 'right' },
  { colKey: 'top_three', title: '前三名', minWidth: 240 },
  { colKey: 'generated_at', title: '生成时间', width: 180 },
  { colKey: 'op', title: '操作', width: 110, fixed: 'right' }
];

const refreshing = computed(() => activeTab.value === 'current' ? currentLoading.value : historyLoading.value);
const currentRows = computed(() => Array.isArray(currentSnapshot.value?.list) ? currentSnapshot.value.list : []);
const normalizedCurrentTopThree = computed(() => {
  const topThree = Array.isArray(currentSnapshot.value?.top_three)
    ? currentSnapshot.value.top_three
    : [];

  return [1, 2, 3].map((rank) => {
    const item = topThree[rank - 1] || {};
    return {
      rank,
      name: item.name || '暂无数据',
      points: item.points || 0
    };
  });
});
const rankingPagination = computed(() => ({
  defaultPageSize: 10,
  showJumper: true,
  total: currentRows.value.length
}));
const historyPagination = computed(() => ({
  current: historyFilters.page,
  pageSize: historyFilters.pageSize,
  total: historyTotal.value,
  showJumper: true,
  pageSizeOptions: [10, 20, 50]
}));
const historyDetailRows = computed(() => Array.isArray(historyDetailSnapshot.value?.list) ? historyDetailSnapshot.value.list : []);
const historyDetailPagination = computed(() => ({
  defaultPageSize: 10,
  showJumper: true,
  total: historyDetailRows.value.length
}));

function getRankTypeLabel(rankType) {
  const item = currentRankOptions.find((option) => option.value === rankType);
  return item ? item.label : '未知榜单';
}

function getRankTheme(rank) {
  if (rank === 1) {
    return 'warning';
  }

  if (rank === 2) {
    return 'primary';
  }

  if (rank === 3) {
    return 'success';
  }

  return 'default';
}

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString('zh-CN', {
    hour12: false
  });
}

function getPeriodText(snapshot) {
  if (!snapshot) {
    return '--';
  }

  if (snapshot.rank_type === 'total') {
    return '累计总榜';
  }

  if (snapshot.period_start_text && snapshot.period_end_text) {
    return snapshot.rank_type === 'month'
      ? snapshot.period_start_text.slice(0, 7)
      : `${snapshot.period_start_text} 至 ${snapshot.period_end_text}`;
  }

  return snapshot.period_key || '--';
}

function getCurrentPeriodText(snapshot) {
  if (!snapshot) {
    return '等待快照生成';
  }

  return getPeriodText(snapshot);
}

function getTopThreeText(topThree = []) {
  if (!Array.isArray(topThree) || !topThree.length) {
    return '--';
  }

  return topThree
    .map((item, index) => `${index + 1}. ${item.name || '--'} ${formatNumber(item.points, '0')}分`)
    .join(' / ');
}

async function loadCurrentRanking() {
  currentLoading.value = true;
  try {
    const data = await getCurrentRanking(currentRankType.value);
    currentSnapshot.value = data.snapshot || null;
  } catch (error) {
    MessagePlugin.warning(error.message || '当前排行榜加载失败');
  } finally {
    currentLoading.value = false;
  }
}

async function loadHistoryRankings() {
  historyLoading.value = true;
  try {
    const data = await getRankingHistory({
      rank_type: historyFilters.rankType,
      page: historyFilters.page,
      page_size: historyFilters.pageSize
    });
    historyRows.value = data.list || [];
    historyTotal.value = data.total || 0;
  } catch (error) {
    MessagePlugin.warning(error.message || '历史排行榜加载失败');
  } finally {
    historyLoading.value = false;
  }
}

function handleHistorySearch() {
  historyFilters.page = 1;
  loadHistoryRankings();
}

function handleHistoryPageChange(pageInfo) {
  historyFilters.page = pageInfo.current;
  historyFilters.pageSize = pageInfo.pageSize;
  loadHistoryRankings();
}

async function openHistoryDetail(row) {
  historyDetailVisible.value = true;
  historyDetailLoading.value = true;
  historyDetailSnapshot.value = null;

  try {
    const data = await getRankingHistoryDetail(row._id);
    historyDetailSnapshot.value = data.snapshot || null;
  } catch (error) {
    MessagePlugin.warning(error.message || '历史排行榜详情加载失败');
  } finally {
    historyDetailLoading.value = false;
  }
}

function refreshActiveTab() {
  if (activeTab.value === 'history') {
    loadHistoryRankings();
    return;
  }

  loadCurrentRanking();
}

function handleTabChange(value) {
  if (value === 'history' && !historyRows.value.length) {
    loadHistoryRankings();
  }
}

onMounted(() => {
  loadCurrentRanking();
});
</script>
