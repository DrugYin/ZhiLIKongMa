<template>
  <section>
    <PageHeader
      eyebrow="Dashboard"
      title="运营概览"
      description="集中查看注册、班级、任务、提交、审核和积分发放等关键运营指标。"
    >
      <template #actions>
        <t-button theme="primary" :loading="loading" @click="loadData">刷新数据</t-button>
      </template>
    </PageHeader>

    <div class="stat-grid">
      <StatCard label="注册用户" :value="formatNumber(overview.user_count)" description="累计注册用户数" />
      <StatCard label="班级数" :value="formatNumber(overview.class_count)" description="当前有效班级" />
      <StatCard label="任务数" :value="formatNumber(overview.task_count)" description="累计任务数量" />
      <StatCard label="待审核" :value="formatNumber(overview.pending_submission_count)" description="任务提交待处理" />
      <StatCard label="提交总数" :value="formatNumber(overview.submission_count)" description="累计任务提交" />
      <StatCard label="审核通过" :value="formatNumber(overview.approved_submission_count)" description="累计通过提交" />
      <StatCard label="学生数" :value="formatNumber(overview.student_count)" description="已注册学生角色" />
      <StatCard label="教师数" :value="formatNumber(overview.teacher_count)" description="已注册教师角色" />
    </div>

    <t-row :gutter="[16, 16]">
      <t-col :span="8">
        <t-card title="提交趋势" class="placeholder-card">
          <div ref="trendChartRef" class="chart-panel"></div>
        </t-card>
      </t-col>
      <t-col :span="4">
        <t-card title="本周概况" class="placeholder-card">
          <div class="weekly-metrics">
            <div>
              <span>本周积分发放</span>
              <strong>{{ formatNumber(overview.weekly_points, '0') }}</strong>
            </div>
            <div>
              <span>审核通过率</span>
              <strong>{{ formatPercent(overview.approval_rate, '0.0%') }}</strong>
            </div>
            <div>
              <span>统计更新时间</span>
              <strong>{{ updatedAtText }}</strong>
            </div>
          </div>
        </t-card>
      </t-col>
    </t-row>

    <t-card title="最近 7 天运营明细" class="trend-table-card">
      <t-table
        row-key="date"
        :data="trend"
        :columns="trendColumns"
        :pagination="null"
        size="medium"
      />
    </t-card>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import StatCard from '@/components/StatCard.vue';
import { getStatistics } from '@/api/dashboard';
import { formatNumber, formatPercent } from '@/utils/format';

const loading = ref(false);
const trendChartRef = ref(null);
const trend = ref([]);
const updatedAt = ref('');
let echartsCore = null;
let trendChart = null;
const overview = reactive({
  user_count: '--',
  student_count: '--',
  teacher_count: '--',
  class_count: '--',
  task_count: '--',
  submission_count: '--',
  pending_submission_count: '--',
  approved_submission_count: '--',
  rejected_submission_count: '--',
  weekly_points: 0,
  approval_rate: 0
});

const trendColumns = [
  { colKey: 'date', title: '日期', width: 140 },
  { colKey: 'submitted_count', title: '提交数', align: 'right' },
  { colKey: 'approved_count', title: '通过数', align: 'right' },
  { colKey: 'points', title: '发放积分', align: 'right' }
];

const updatedAtText = computed(() => {
  if (!updatedAt.value) {
    return '--';
  }
  return new Date(updatedAt.value).toLocaleString('zh-CN', {
    hour12: false
  });
});

async function loadData() {
  loading.value = true;
  try {
    const data = await getStatistics({ range_type: '7d' });
    Object.assign(overview, data.overview || {});
    trend.value = data.trend || [];
    updatedAt.value = data.updated_at || '';
    await ensureTrendChartReady();
    await nextTick();
    renderTrendChart();
  } catch (error) {
    MessagePlugin.warning(error.message || '运营统计加载失败');
  } finally {
    loading.value = false;
  }
}

function renderTrendChart() {
  if (!trendChartRef.value || !echartsCore) {
    return;
  }

  if (!trendChart) {
    trendChart = echartsCore.init(trendChartRef.value);
  }

  const dates = trend.value.map((item) => item.date.slice(5));

  trendChart.setOption({
    color: ['#1d6f5f', '#e6a23c', '#2f947f'],
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      top: 0,
      right: 0
    },
    grid: {
      left: 40,
      right: 24,
      top: 48,
      bottom: 32
    },
    xAxis: {
      type: 'category',
      data: dates
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series: [
      {
        name: '提交数',
        type: 'bar',
        barMaxWidth: 28,
        data: trend.value.map((item) => item.submitted_count)
      },
      {
        name: '通过数',
        type: 'line',
        smooth: true,
        data: trend.value.map((item) => item.approved_count)
      },
      {
        name: '积分',
        type: 'line',
        smooth: true,
        data: trend.value.map((item) => item.points)
      }
    ]
  });
}

async function ensureTrendChartReady() {
  if (echartsCore) {
    return;
  }

  const [
    echarts,
    charts,
    components,
    renderers
  ] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers')
  ]);

  echarts.use([
    charts.BarChart,
    charts.LineChart,
    components.GridComponent,
    components.LegendComponent,
    components.TooltipComponent,
    renderers.CanvasRenderer
  ]);
  echartsCore = echarts;
}

function handleResize() {
  trendChart?.resize();
}

onMounted(() => {
  loadData();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  trendChart = null;
});
</script>
