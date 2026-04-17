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
      <StatCard label="注册用户" :value="overview.user_count" description="累计注册用户数" />
      <StatCard label="班级数" :value="overview.class_count" description="当前有效班级" />
      <StatCard label="任务数" :value="overview.task_count" description="累计任务数量" />
      <StatCard label="待审核" :value="overview.pending_submission_count" description="任务提交待处理" />
    </div>

    <t-row :gutter="[16, 16]">
      <t-col :span="8">
        <t-card title="提交趋势" class="placeholder-card">
          <div class="chart-placeholder">ECharts 趋势图预留区域</div>
        </t-card>
      </t-col>
      <t-col :span="4">
        <t-card title="本周概况" class="placeholder-card">
          <p>本周积分发放：{{ overview.weekly_points || 0 }}</p>
          <p>审核通过率：{{ overview.approval_rate || 0 }}%</p>
        </t-card>
      </t-col>
    </t-row>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import StatCard from '@/components/StatCard.vue';
import { getStatistics } from '@/api/dashboard';

const loading = ref(false);
const overview = reactive({
  user_count: '--',
  class_count: '--',
  task_count: '--',
  pending_submission_count: '--',
  weekly_points: 0,
  approval_rate: 0
});

async function loadData() {
  loading.value = true;
  try {
    const data = await getStatistics({ range_type: '7d' });
    Object.assign(overview, data.overview || {});
  } catch (error) {
    MessagePlugin.warning(error.message || '统计云函数待接入');
  } finally {
    loading.value = false;
  }
}
</script>
