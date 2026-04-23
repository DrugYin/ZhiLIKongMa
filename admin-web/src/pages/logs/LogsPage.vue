<template>
  <section>
    <PageHeader
      eyebrow="Operation Logs"
      title="操作日志"
      description="追踪后台配置、项目、用户、班级、任务、提交审核以及小程序端关键业务操作。"
    >
      <template #actions>
        <t-button variant="outline" :loading="loading" @click="loadLogs">刷新</t-button>
      </template>
    </PageHeader>

    <div class="log-stat-grid">
      <t-card :bordered="false" class="log-stat-card">
        <span>当前筛选</span>
        <strong>{{ logTotal }}</strong>
        <em>条操作日志</em>
      </t-card>
      <t-card :bordered="false" class="log-stat-card">
        <span>后台操作</span>
        <strong>{{ summary.actor_types?.admin || 0 }}</strong>
        <em>管理员动作</em>
      </t-card>
      <t-card :bordered="false" class="log-stat-card">
        <span>教师操作</span>
        <strong>{{ summary.actor_types?.teacher || 0 }}</strong>
        <em>小程序教师端</em>
      </t-card>
      <t-card :bordered="false" class="log-stat-card">
        <span>学生操作</span>
        <strong>{{ summary.actor_types?.student || 0 }}</strong>
        <em>小程序学生端</em>
      </t-card>
    </div>

    <t-card :bordered="false" class="config-card log-card">
      <div class="config-toolbar log-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索操作者、目标、动作或详情"
          class="log-search"
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-select
          v-model="filters.module"
          clearable
          placeholder="全部模块"
          class="log-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option v-for="item in moduleOptions" :key="item.value" :label="item.label" :value="item.value" />
        </t-select>
        <t-select
          v-model="filters.actor_type"
          clearable
          placeholder="全部来源"
          class="log-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option label="后台管理员" value="admin" />
          <t-option label="教师端" value="teacher" />
          <t-option label="学生端" value="student" />
        </t-select>
        <t-select
          v-model="filters.action"
          clearable
          filterable
          placeholder="全部动作"
          class="log-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option v-for="item in actionOptions" :key="item" :label="getActionLabel(item)" :value="item" />
        </t-select>
        <t-input
          v-model="filters.start_date"
          class="log-date"
          placeholder="开始日期 YYYY-MM-DD"
          @enter="handleSearch"
        />
        <t-input
          v-model="filters.end_date"
          class="log-date"
          placeholder="结束日期 YYYY-MM-DD"
          @enter="handleSearch"
        />
        <t-button :loading="loading" @click="handleSearch">查询</t-button>
      </div>

      <div class="log-module-strip">
        <t-tag
          v-for="item in topModules"
          :key="item.module"
          theme="primary"
          variant="light"
        >
          {{ getModuleLabel(item.module) }} {{ item.count }}
        </t-tag>
      </div>

      <div class="log-table-shell">
        <t-table
          row-key="_id"
          class="log-table"
          :data="logRows"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          hover
          @page-change="handlePageChange"
        >
          <template #module="{ row }">
            <t-tag theme="primary" variant="light">{{ getModuleLabel(row.module) }}</t-tag>
          </template>

          <template #action="{ row }">
            <t-tag :theme="getActionTheme(row.action)" variant="light">
              {{ getActionLabel(row.action) }}
            </t-tag>
          </template>

          <template #actor="{ row }">
            <div class="log-title-cell">
              <strong>{{ row.actor_name || '--' }}</strong>
              <span>{{ getActorTypeLabel(row.actor_type) }} · {{ getActorMeta(row) }}</span>
            </div>
          </template>

          <template #target="{ row }">
            <div class="log-title-cell">
              <strong>{{ row.target_key || '--' }}</strong>
              <span>{{ row.target_id || '--' }}</span>
            </div>
          </template>

          <template #create_time="{ row }">
            {{ formatDateTime(row.create_time) }}
          </template>

          <template #op="{ row }">
            <t-button size="small" variant="text" @click="openDetailDialog(row)">详情</t-button>
          </template>
        </t-table>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="detailDialogVisible"
      header="操作日志详情"
      width="820px"
      :footer="false"
    >
      <div v-if="selectedLog" class="log-detail">
        <div class="log-detail-summary">
          <div>
            <span>模块</span>
            <strong>{{ getModuleLabel(selectedLog.module) }}</strong>
          </div>
          <div>
            <span>动作</span>
            <strong>{{ getActionLabel(selectedLog.action) }}</strong>
          </div>
          <div>
            <span>操作者</span>
            <strong>{{ selectedLog.actor_name || '--' }}</strong>
          </div>
          <div>
            <span>时间</span>
            <strong>{{ formatDateTime(selectedLog.create_time) }}</strong>
          </div>
        </div>

        <div class="log-detail-grid">
          <div>
            <span>来源</span>
            <strong>{{ getActorTypeLabel(selectedLog.actor_type) }}</strong>
          </div>
          <div>
            <span>操作者 ID</span>
            <strong>{{ selectedLog.actor_id || selectedLog.actor_openid || '--' }}</strong>
          </div>
          <div>
            <span>手机号</span>
            <strong>{{ selectedLog.actor_phone || '--' }}</strong>
          </div>
          <div>
            <span>目标</span>
            <strong>{{ selectedLog.target_key || selectedLog.target_id || '--' }}</strong>
          </div>
          <div>
            <span>目标 ID</span>
            <strong>{{ selectedLog.target_id || '--' }}</strong>
          </div>
        </div>

        <section class="log-json-panel">
          <h3>详情数据</h3>
          <pre>{{ formatDetail(selectedLog.detail) }}</pre>
        </section>
      </div>
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { getOperationLogDetail, getOperationLogs } from '@/api/logs';

const moduleOptions = [
  { label: '系统配置', value: 'system_config' },
  { label: '项目配置', value: 'projects' },
  { label: '用户管理', value: 'users' },
  { label: '班级管理', value: 'classes' },
  { label: '任务管理', value: 'tasks' },
  { label: '提交记录', value: 'submissions' },
  { label: '小程序任务', value: 'task' },
  { label: '小程序班级', value: 'class' },
  { label: '小程序用户', value: 'user' },
  { label: '小程序提交', value: 'submission' }
];

const actionOptions = [
  'create',
  'update',
  'delete',
  'review',
  'create_task',
  'update_task',
  'delete_task',
  'submit_task',
  'review_submission',
  'create_class',
  'update_class',
  'delete_class',
  'join_class',
  'remove_member',
  'register'
];

const columns = [
  { colKey: 'module', title: '模块', width: 120 },
  { colKey: 'action', title: '动作', width: 130 },
  { colKey: 'actor', title: '操作者', width: 220 },
  { colKey: 'target', title: '目标', width: 240 },
  { colKey: 'create_time', title: '时间', width: 170 },
  { colKey: 'op', title: '操作', width: 90 }
];

const loading = ref(false);
const detailDialogVisible = ref(false);
const logRows = ref([]);
const logTotal = ref(0);
const selectedLog = ref(null);
const summary = reactive({
  total: 0,
  modules: {},
  actor_types: {}
});

const filters = reactive({
  keyword: '',
  module: '',
  action: '',
  actor_type: '',
  start_date: '',
  end_date: '',
  page: 1,
  pageSize: 20
});

const pagination = computed(() => ({
  current: filters.page,
  pageSize: filters.pageSize,
  total: logTotal.value,
  showJumper: true,
  showPageSize: true
}));

const topModules = computed(() => Object.entries(summary.modules || {})
  .map(([module, count]) => ({ module, count }))
  .sort((left, right) => right.count - left.count)
  .slice(0, 8));

function resetSummary(data = {}) {
  summary.total = data.total || 0;
  summary.modules = data.modules || {};
  summary.actor_types = data.actor_types || {};
}

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function getModuleLabel(moduleName) {
  const found = moduleOptions.find((item) => item.value === moduleName);
  return found?.label || moduleName || '--';
}

function getActorTypeLabel(type) {
  const map = {
    admin: '后台管理员',
    teacher: '教师端',
    student: '学生端',
    unknown: '未知来源'
  };
  return map[type] || type || '--';
}

function getShortId(value) {
  const text = String(value || '');
  if (!text) {
    return '--';
  }

  return text.length > 18 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text;
}

function getActorMeta(row = {}) {
  return row.actor_phone
    || getShortId(row.actor_openid || row.actor_id);
}

function getActionLabel(action) {
  const map = {
    create: '新增',
    update: '更新',
    delete: '删除',
    review: '审核',
    create_task: '创建任务',
    update_task: '更新任务',
    delete_task: '删除任务',
    submit_task: '提交任务',
    review_submission: '审核提交',
    create_class: '创建班级',
    update_class: '更新班级',
    delete_class: '删除班级',
    join_class: '加入班级',
    remove_member: '移除成员',
    register: '注册'
  };
  return map[action] || action || '--';
}

function getActionTheme(action) {
  if (/delete|remove|reject/.test(action || '')) {
    return 'danger';
  }

  if (/review|approve/.test(action || '')) {
    return 'warning';
  }

  if (/create|join|register|submit/.test(action || '')) {
    return 'success';
  }

  return 'primary';
}

function formatDetail(detail) {
  if (!detail || typeof detail !== 'object') {
    return '{}';
  }

  return JSON.stringify(detail, null, 2);
}

async function loadLogs() {
  loading.value = true;
  try {
    const data = await getOperationLogs({
      keyword: filters.keyword,
      module: filters.module,
      action: filters.action,
      actor_type: filters.actor_type,
      start_date: filters.start_date,
      end_date: filters.end_date,
      page: filters.page,
      page_size: filters.pageSize
    });
    logRows.value = data.list || [];
    logTotal.value = data.total || 0;
    resetSummary(data.summary || {});
  } catch (error) {
    MessagePlugin.error(error.message || '操作日志加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  filters.page = 1;
  loadLogs();
}

function handlePageChange(pageInfo) {
  filters.page = pageInfo.current || 1;
  filters.pageSize = pageInfo.pageSize || filters.pageSize;
  loadLogs();
}

async function openDetailDialog(row) {
  detailDialogVisible.value = true;
  selectedLog.value = row;

  try {
    const data = await getOperationLogDetail(row._id);
    selectedLog.value = data.log || row;
  } catch (error) {
    MessagePlugin.warning(error.message || '日志详情加载失败，已展示列表数据');
  }
}

onMounted(() => {
  loadLogs();
});
</script>
