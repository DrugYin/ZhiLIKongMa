<template>
  <section>
    <PageHeader
      eyebrow="Projects"
      title="项目配置"
      description="维护编程、无人机、机器人等训练项目的基础配置。"
    >
      <template #actions>
        <t-button theme="primary" :loading="loading" @click="loadProjects">读取项目</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false">
      <t-table row-key="project_code" :data="projectRows" :columns="columns" :loading="loading" />
    </t-card>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { getProjects } from '@/api/projects';

const loading = ref(false);
const projectRows = ref([
  { project_name: '编程', project_code: 'programming', status: 'active', sort_order: 1 },
  { project_name: '无人机', project_code: 'drone', status: 'active', sort_order: 2 },
  { project_name: '机器人', project_code: 'robot', status: 'active', sort_order: 3 }
]);

const columns = [
  { colKey: 'project_name', title: '项目名称', width: 160 },
  { colKey: 'project_code', title: '项目编码', width: 180 },
  { colKey: 'status', title: '状态', width: 120 },
  { colKey: 'sort_order', title: '排序', width: 100 },
  { colKey: 'description', title: '说明' }
];

async function loadProjects() {
  loading.value = true;
  try {
    const data = await getProjects();
    projectRows.value = data.list || data || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '项目管理云函数待接入，当前展示默认项目');
  } finally {
    loading.value = false;
  }
}
</script>
