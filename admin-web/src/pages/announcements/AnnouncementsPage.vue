<template>
  <section>
    <PageHeader
      eyebrow="Announcements"
      title="公告管理"
      description="发布小程序公告，控制弹出频率与可见范围，支持按角色或指定用户投放。"
    >
      <template #actions>
        <t-button variant="outline" :loading="loading" @click="loadAnnouncements">刷新</t-button>
        <t-button theme="primary" @click="openCreateDialog">新增公告</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false" class="config-card announcement-card">
      <div class="config-toolbar announcement-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索标题、内容、角色或用户 OpenID"
          class="announcement-search"
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-select
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          class="announcement-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </t-select>
        <t-select
          v-model="filters.visibility_type"
          clearable
          placeholder="全部范围"
          class="announcement-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option v-for="item in visibilityOptions" :key="item.value" :label="item.label" :value="item.value" />
        </t-select>
        <t-button :loading="loading" @click="handleSearch">查询</t-button>
      </div>

      <div class="announcement-table-shell">
        <t-table
          row-key="_id"
          class="announcement-table"
          :data="announcementRows"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          hover
          @page-change="handlePageChange"
        >
          <template #title="{ row }">
            <div class="announcement-title-cell">
              <strong>{{ row.title }}</strong>
              <span>{{ getContentSummary(row.content) }}</span>
            </div>
          </template>

          <template #status="{ row }">
            <t-tag :theme="getStatusTheme(row.status)" variant="light">
              {{ getStatusLabel(row.status) }}
            </t-tag>
          </template>

          <template #display_mode="{ row }">
            <t-tag theme="primary" variant="light">{{ getDisplayModeLabel(row.display_mode) }}</t-tag>
          </template>

          <template #visibility_type="{ row }">
            <div class="announcement-scope-cell">
              <t-tag :theme="getVisibilityTheme(row.visibility_type)" variant="light">
                {{ getVisibilityLabel(row.visibility_type) }}
              </t-tag>
              <span>{{ getScopeDetail(row) }}</span>
            </div>
          </template>

          <template #active_time="{ row }">
            <div class="announcement-time-cell">
              <span>{{ formatDateTime(row.start_time) || '立即生效' }}</span>
              <span>{{ formatDateTime(row.end_time) || '长期有效' }}</span>
            </div>
          </template>

          <template #update_time="{ row }">
            {{ formatDateTime(row.update_time || row.create_time) || '--' }}
          </template>

          <template #op="{ row }">
            <t-space>
              <t-button size="small" variant="text" @click="openDetailDialog(row)">查看</t-button>
              <t-button size="small" variant="text" @click="openEditDialog(row)">编辑</t-button>
              <t-button
                v-if="row.status !== 'published'"
                size="small"
                variant="text"
                @click="handlePublish(row)"
              >
                发布
              </t-button>
              <t-button
                v-if="row.status === 'published'"
                size="small"
                variant="text"
                @click="handleClose(row)"
              >
                关闭
              </t-button>
              <t-popconfirm content="删除后小程序不再展示该公告，确认删除？" @confirm="handleDelete(row)">
                <t-button size="small" theme="danger" variant="text">删除</t-button>
              </t-popconfirm>
            </t-space>
          </template>
        </t-table>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="formDialogVisible"
      :header="isEditing ? '编辑公告' : '新增公告'"
      width="780px"
      :confirm-btn="{ content: isEditing ? '保存修改' : '创建公告', loading: saving }"
      :cancel-btn="{ content: '取消' }"
      @confirm="handleSubmit"
    >
      <t-form ref="formRef" :data="form" :rules="rules" label-width="112px" class="announcement-form">
        <t-form-item label="公告标题" name="title">
          <t-input v-model="form.title" placeholder="请输入公告标题" />
        </t-form-item>

        <t-form-item label="公告内容" name="content">
          <t-textarea
            v-model="form.content"
            :autosize="{ minRows: 5, maxRows: 10 }"
            placeholder="请输入公告正文，支持换行展示"
          />
        </t-form-item>

        <t-row :gutter="[16, 0]">
          <t-col :span="4">
            <t-form-item label="状态" name="status">
              <t-select v-model="form.status" placeholder="请选择状态">
                <t-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="4">
            <t-form-item label="弹出策略" name="display_mode">
              <t-select v-model="form.display_mode" placeholder="请选择弹出策略">
                <t-option v-for="item in displayModeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="4">
            <t-form-item label="排序" name="sort_order">
              <t-input-number v-model="form.sort_order" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="开始时间" name="start_time">
              <t-date-picker
                v-model="startTimeValue"
                placeholder="选择开始时间"
                allow-input
                clearable
                enable-time-picker
                format="YYYY-MM-DD HH:mm"
                @change="(val) => onDateTimeChange('start_time', val)"
              />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="结束时间" name="end_time">
              <t-date-picker
                v-model="endTimeValue"
                placeholder="选择结束时间"
                allow-input
                clearable
                enable-time-picker
                format="YYYY-MM-DD HH:mm"
                @change="(val) => onDateTimeChange('end_time', val)"
              />
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="可见范围" name="visibility_type">
          <t-radio-group v-model="form.visibility_type" @change="handleVisibilityChange">
            <t-radio-button v-for="item in visibilityOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </t-radio-button>
          </t-radio-group>
        </t-form-item>

        <t-form-item v-if="form.visibility_type === 'role'" label="可见角色" name="target_roles">
          <t-select v-model="form.target_roles" multiple placeholder="请选择可见角色">
            <t-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </t-select>
        </t-form-item>

        <t-form-item v-if="form.visibility_type === 'users'" label="指定用户" name="target_user_openids">
          <t-select
            v-model="form.target_user_openids"
            multiple
            filterable
            placeholder="请选择指定用户，也可粘贴 OpenID 后回车"
            creatable
          >
            <t-option
              v-for="item in userOptions"
              :key="item._openid"
              :label="getUserOptionLabel(item)"
              :value="item._openid"
            />
          </t-select>
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="detailDialogVisible"
      header="公告详情"
      width="720px"
      :footer="false"
    >
      <div v-if="selectedAnnouncement" class="announcement-detail">
        <div class="announcement-detail-head">
          <div>
            <span>公告标题</span>
            <strong>{{ selectedAnnouncement.title }}</strong>
          </div>
          <div>
            <span>状态</span>
            <strong>{{ getStatusLabel(selectedAnnouncement.status) }}</strong>
          </div>
          <div>
            <span>弹出策略</span>
            <strong>{{ getDisplayModeLabel(selectedAnnouncement.display_mode) }}</strong>
          </div>
        </div>
        <div class="announcement-detail-content">{{ selectedAnnouncement.content }}</div>
        <div class="announcement-detail-meta">
          <span>可见范围：{{ getVisibilityLabel(selectedAnnouncement.visibility_type) }} / {{ getScopeDetail(selectedAnnouncement) }}</span>
          <span>有效时间：{{ formatDateTime(selectedAnnouncement.start_time) || '立即生效' }} 至 {{ formatDateTime(selectedAnnouncement.end_time) || '长期有效' }}</span>
        </div>
      </div>
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import {
  closeAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  publishAnnouncement,
  updateAnnouncement
} from '@/api/announcements';
import { getUsers } from '@/api/users';

const DEFAULT_FORM = {
  _id: '',
  title: '',
  content: '',
  status: 'draft',
  display_mode: 'once',
  visibility_type: 'all',
  target_roles: [],
  target_user_openids: [],
  start_time: '',
  end_time: '',
  sort_order: 100
};

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已关闭', value: 'closed' }
];

const displayModeOptions = [
  { label: '弹出一次', value: 'once' },
  { label: '每次进入弹出', value: 'always' }
];

const visibilityOptions = [
  { label: '所有人可见', value: 'all' },
  { label: '按角色可见', value: 'role' },
  { label: '指定用户可见', value: 'users' }
];

const roleOptions = [
  { label: '学生', value: 'student' },
  { label: '教师', value: 'teacher' },
  { label: '管理员', value: 'admin' }
];

const columns = [
  { colKey: 'title', title: '公告', minWidth: 260, fixed: 'left' },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'display_mode', title: '弹出策略', width: 130 },
  { colKey: 'visibility_type', title: '可见范围', minWidth: 180 },
  { colKey: 'active_time', title: '有效时间', width: 190 },
  { colKey: 'update_time', title: '更新时间', width: 170 },
  { colKey: 'op', title: '操作', width: 240, fixed: 'right' }
];

const rules = {
  title: [
    { required: true, message: '请输入公告标题' },
    { max: 40, message: '公告标题不能超过 40 个字符' }
  ],
  content: [
    { required: true, message: '请输入公告内容' },
    { max: 2000, message: '公告内容不能超过 2000 个字符' }
  ],
  status: [{ required: true, message: '请选择状态' }],
  display_mode: [{ required: true, message: '请选择弹出策略' }],
  visibility_type: [{ required: true, message: '请选择可见范围' }],
  target_roles: [{ validator: validateTargetRoles }],
  target_user_openids: [{ validator: validateTargetUsers }]
};

const loading = ref(false);
const saving = ref(false);
const formDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const formRef = ref(null);
const announcementRows = ref([]);
const userOptions = ref([]);
const selectedAnnouncement = ref(null);
const total = ref(0);
const filters = reactive({
  keyword: '',
  status: '',
  visibility_type: '',
  page: 1,
  pageSize: 20
});
const form = reactive({ ...DEFAULT_FORM });

function parseDateTimeString(str) {
  if (!str) return null;
  const d = new Date(str.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

const startTimeValue = computed(() => parseDateTimeString(form.start_time));
const endTimeValue = computed(() => parseDateTimeString(form.end_time));

function onDateTimeChange(field, val) {
  if (!val) {
    form[field] = '';
    return;
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return;
  const pad = (n) => String(n).padStart(2, '0');
  form[field] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const isEditing = computed(() => Boolean(form._id));
const pagination = computed(() => ({
  current: filters.page,
  pageSize: filters.pageSize,
  total: total.value,
  showJumper: true,
  pageSizeOptions: [10, 20, 50, 100]
}));

function validateTargetRoles(value) {
  if (form.visibility_type !== 'role' || (Array.isArray(value) && value.length)) {
    return true;
  }
  return { result: false, message: '按角色可见时至少选择一个角色' };
}

function validateTargetUsers(value) {
  if (form.visibility_type !== 'users' || (Array.isArray(value) && value.length)) {
    return true;
  }
  return { result: false, message: '指定用户可见时至少选择一个用户' };
}

function resetForm(row = {}) {
  Object.assign(form, {
    ...DEFAULT_FORM,
    ...row,
    target_roles: Array.isArray(row.target_roles) ? [...row.target_roles] : [],
    target_user_openids: Array.isArray(row.target_user_openids) ? [...row.target_user_openids] : [],
    start_time: formatInputDateTime(row.start_time),
    end_time: formatInputDateTime(row.end_time),
    sort_order: Number(row.sort_order ?? DEFAULT_FORM.sort_order)
  });
}

function openCreateDialog() {
  resetForm();
  formDialogVisible.value = true;
}

function openEditDialog(row) {
  resetForm(row);
  formDialogVisible.value = true;
}

function openDetailDialog(row) {
  selectedAnnouncement.value = row;
  detailDialogVisible.value = true;
}

function handleVisibilityChange() {
  if (form.visibility_type !== 'role') {
    form.target_roles = [];
  }
  if (form.visibility_type !== 'users') {
    form.target_user_openids = [];
  }
}

function normalizePayload() {
  return {
    _id: form._id,
    title: form.title.trim(),
    content: form.content.trim(),
    status: form.status,
    display_mode: form.display_mode,
    visibility_type: form.visibility_type,
    target_roles: form.visibility_type === 'role' ? form.target_roles : [],
    target_user_openids: form.visibility_type === 'users' ? form.target_user_openids : [],
    start_time: form.start_time.trim(),
    end_time: form.end_time.trim(),
    sort_order: Number(form.sort_order || 0)
  };
}

function handleSearch() {
  filters.page = 1;
  loadAnnouncements();
}

function handlePageChange(pageInfo) {
  filters.page = pageInfo.current || 1;
  filters.pageSize = pageInfo.pageSize || filters.pageSize;
  loadAnnouncements();
}

async function loadAnnouncements() {
  loading.value = true;
  try {
    const data = await getAnnouncements({
      keyword: filters.keyword.trim(),
      status: filters.status,
      visibility_type: filters.visibility_type,
      page: filters.page,
      page_size: filters.pageSize
    });
    announcementRows.value = data.list || [];
    total.value = data.total || 0;
  } catch (error) {
    MessagePlugin.error(error.message || '公告列表加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadUserOptions() {
  try {
    const data = await getUsers({
      page: 1,
      page_size: 100
    });
    userOptions.value = (data.list || []).filter((item) => item._openid);
  } catch (error) {
    MessagePlugin.warning(error.message || '用户列表加载失败，仍可手动输入 OpenID');
  }
}

async function handleSubmit() {
  const validResult = await formRef.value?.validate();
  if (validResult !== true) {
    return;
  }

  saving.value = true;
  try {
    if (isEditing.value) {
      await updateAnnouncement(normalizePayload());
      MessagePlugin.success('公告已更新');
    } else {
      await createAnnouncement(normalizePayload());
      MessagePlugin.success('公告已创建');
    }

    formDialogVisible.value = false;
    await loadAnnouncements();
  } catch (error) {
    MessagePlugin.error(error.message || '公告保存失败');
  } finally {
    saving.value = false;
  }
}

async function handlePublish(row) {
  loading.value = true;
  try {
    await publishAnnouncement(row._id);
    MessagePlugin.success('公告已发布');
    await loadAnnouncements();
  } catch (error) {
    MessagePlugin.error(error.message || '公告发布失败');
  } finally {
    loading.value = false;
  }
}

async function handleClose(row) {
  loading.value = true;
  try {
    await closeAnnouncement(row._id);
    MessagePlugin.success('公告已关闭');
    await loadAnnouncements();
  } catch (error) {
    MessagePlugin.error(error.message || '公告关闭失败');
  } finally {
    loading.value = false;
  }
}

async function handleDelete(row) {
  loading.value = true;
  try {
    await deleteAnnouncement({ _id: row._id });
    MessagePlugin.success('公告已删除');
    await loadAnnouncements();
  } catch (error) {
    MessagePlugin.error(error.message || '公告删除失败');
  } finally {
    loading.value = false;
  }
}

function getStatusLabel(status) {
  return statusOptions.find((item) => item.value === status)?.label || status;
}

function getStatusTheme(status) {
  const themeMap = {
    draft: 'default',
    published: 'success',
    closed: 'danger'
  };
  return themeMap[status] || 'default';
}

function getDisplayModeLabel(mode) {
  return displayModeOptions.find((item) => item.value === mode)?.label || mode;
}

function getVisibilityLabel(type) {
  return visibilityOptions.find((item) => item.value === type)?.label || type;
}

function getVisibilityTheme(type) {
  const themeMap = {
    all: 'success',
    role: 'warning',
    users: 'primary'
  };
  return themeMap[type] || 'default';
}

function getRoleLabel(role) {
  return roleOptions.find((item) => item.value === role)?.label || role;
}

function getScopeDetail(row) {
  if (row.visibility_type === 'role') {
    return (row.target_roles || []).map(getRoleLabel).join('、') || '--';
  }
  if (row.visibility_type === 'users') {
    return `${(row.target_user_openids || []).length} 位用户`;
  }
  return '全体小程序用户';
}

function getContentSummary(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
}

function getUserOptionLabel(user) {
  return `${user.user_name || user.nick_name || '未命名用户'} / ${getRoleText(user.roles)} / ${user._openid}`;
}

function getRoleText(roles = []) {
  return roles.map(getRoleLabel).join('、') || '无角色';
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('zh-CN', {
    hour12: false
  });
}

function formatInputDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

onMounted(() => {
  loadAnnouncements();
  loadUserOptions();
});
</script>
