<template>
  <section>
    <PageHeader
      eyebrow="System Config"
      title="系统配置"
      description="管理注册赠送积分、任务提交次数、抽奖开关等运营参数。"
    >
      <template #actions>
        <t-button theme="primary" :loading="loading" @click="loadConfig">读取配置</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false">
      <t-table row-key="config_key" :data="configRows" :columns="columns" :loading="loading" />
    </t-card>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { getConfigList } from '@/api/config';

const loading = ref(false);
const configRows = ref([
  { config_key: 'points_register_gift', config_value: 50, category: 'points', description: '注册赠送积分' },
  { config_key: 'task_max_submissions', config_value: 3, category: 'task', description: '任务默认最大提交次数' },
  { config_key: 'lottery_enabled', config_value: false, category: 'lottery', description: '抽奖功能开关' }
]);

const columns = [
  { colKey: 'config_key', title: '配置键', width: 220 },
  { colKey: 'config_value', title: '配置值', width: 140 },
  { colKey: 'category', title: '分类', width: 120 },
  { colKey: 'description', title: '说明' }
];

async function loadConfig() {
  loading.value = true;
  try {
    const data = await getConfigList();
    configRows.value = data.list || data || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '配置云函数待接入，当前展示默认配置');
  } finally {
    loading.value = false;
  }
}
</script>
