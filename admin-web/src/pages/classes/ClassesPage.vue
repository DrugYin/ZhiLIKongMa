<template>
  <section>
    <PageHeader
      eyebrow="Classes"
      title="班级管理"
      description="统一维护班级、教师、项目、成员和入班申请，数据直接写入云开发班级集合。"
    >
      <template #actions>
        <t-button variant="outline" :loading="loading" @click="loadClasses">刷新</t-button>
        <t-button theme="primary" @click="openCreateDialog">新增班级</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false" class="config-card">
      <div class="config-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索班级、邀请码、教师、地点"
          class="class-search"
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-select
          v-model="filters.project_code"
          clearable
          placeholder="全部项目"
          class="class-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option
            v-for="project in projectOptions"
            :key="project.project_code"
            :label="project.project_name"
            :value="project.project_code"
          />
        </t-select>
        <t-select
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          class="class-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option label="启用" value="active" />
          <t-option label="停用" value="inactive" />
          <t-option label="已删除" value="deleted" />
        </t-select>
        <t-button :loading="loading" @click="handleSearch">查询</t-button>
      </div>

      <t-table
        row-key="_id"
        :data="classRows"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        hover
        @page-change="handlePageChange"
      >
        <template #class_name="{ row }">
          <div class="class-name-cell">
            <strong>{{ row.class_name }}</strong>
            <span>{{ row.class_code }}</span>
          </div>
        </template>

        <template #project_name="{ row }">
          <t-tag theme="primary" variant="light">{{ row.project_name || row.project_code || '--' }}</t-tag>
        </template>

        <template #member_count="{ row }">
          <span>{{ row.member_count || 0 }} / {{ row.max_members || 0 }}</span>
        </template>

        <template #pending_application_count="{ row }">
          <t-tag :theme="row.pending_application_count ? 'warning' : 'default'" variant="light">
            {{ row.pending_application_count || 0 }}
          </t-tag>
        </template>

        <template #status="{ row }">
          <t-tag :theme="getStatusTheme(row.status)" variant="light">
            {{ getStatusLabel(row.status) }}
          </t-tag>
        </template>

        <template #update_time="{ row }">
          {{ formatDateTime(row.update_time || row.create_time) }}
        </template>

        <template #op="{ row }">
          <t-space>
            <t-button size="small" variant="text" @click="openDetailDialog(row)">查看</t-button>
            <t-button
              v-if="row.status !== 'deleted'"
              size="small"
              variant="text"
              @click="openEditDialog(row)"
            >
              编辑
            </t-button>
            <t-popconfirm
              v-if="row.status !== 'deleted'"
              content="删除班级会移除成员关系并拒绝待处理申请，确认继续？"
              @confirm="handleDelete(row)"
            >
              <t-button size="small" theme="danger" variant="text">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog
      v-model:visible="formDialogVisible"
      :header="isEditing ? '编辑班级' : '新增班级'"
      width="760px"
      :confirm-btn="{ content: isEditing ? '保存修改' : '创建班级', loading: saving }"
      :cancel-btn="{ content: '取消' }"
      @confirm="handleSubmit"
    >
      <t-form ref="formRef" :data="form" :rules="rules" label-width="112px">
        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="班级名称" name="class_name">
              <t-input v-model="form.class_name" placeholder="例如 编程基础一班" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="邀请码" name="class_code">
              <t-input
                v-model="form.class_code"
                :disabled="isEditing"
                placeholder="留空自动生成"
              />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="所属项目" name="project_code">
              <t-select v-model="form.project_code" placeholder="请选择项目" @change="syncProjectName">
                <t-option
                  v-for="project in projectOptions"
                  :key="project.project_code"
                  :label="project.project_name"
                  :value="project.project_code"
                />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="班级教师" name="teacher_openid">
              <t-select
                v-model="form.teacher_openid"
                filterable
                placeholder="请选择教师"
                @change="syncTeacherName"
              >
                <t-option
                  v-for="teacher in teacherOptions"
                  :key="teacher._openid"
                  :label="getTeacherOptionLabel(teacher)"
                  :value="teacher._openid"
                />
              </t-select>
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="状态" name="status">
              <t-select v-model="form.status" placeholder="请选择状态">
                <t-option label="启用" value="active" />
                <t-option label="停用" value="inactive" />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="人数上限" name="max_members">
              <t-input-number v-model="form.max_members" :min="1" theme="normal" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="上课时间" name="class_time">
              <t-input v-model="form.class_time" placeholder="例如 每周六 14:00-16:00" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="上课地点" name="location">
              <t-input v-model="form.location" placeholder="例如 3号楼201教室" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="班级说明" name="description">
          <t-textarea
            v-model="form.description"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="班级介绍、适合学员、运营备注等"
          />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="detailDialogVisible"
      header="班级详情"
      width="920px"
      :footer="false"
    >
      <div v-if="selectedClass" class="class-detail">
        <div class="class-detail-summary">
          <div>
            <span>班级</span>
            <strong>{{ selectedClass.class_name }}</strong>
          </div>
          <div>
            <span>邀请码</span>
            <strong>{{ selectedClass.class_code }}</strong>
          </div>
          <div>
            <span>成员</span>
            <strong>{{ selectedClass.member_count || 0 }} / {{ selectedClass.max_members || 0 }}</strong>
          </div>
          <div>
            <span>待审批</span>
            <strong>{{ selectedClass.pending_application_count || 0 }}</strong>
          </div>
        </div>

        <t-tabs v-model="detailTab" @change="handleDetailTabChange">
          <t-tab-panel value="members" label="班级成员">
            <t-table
              row-key="member_openid"
              :data="memberRows"
              :columns="memberColumns"
              :loading="detailLoading"
              :pagination="memberPagination"
              size="medium"
              @page-change="handleMemberPageChange"
            >
              <template #name="{ row }">
                <div class="class-member-cell">
                  <strong>{{ row.user_name || row.nick_name || '未命名用户' }}</strong>
                  <span>{{ row.phone || row.member_openid || '--' }}</span>
                </div>
              </template>
              <template #points="{ row }">
                {{ row.points || 0 }} / {{ row.total_points || 0 }}
              </template>
              <template #join_class_time="{ row }">
                {{ formatDateTime(row.join_class_time) }}
              </template>
              <template #op="{ row }">
                <t-popconfirm content="确认将该成员移出班级？" @confirm="handleRemoveMember(row)">
                  <t-button size="small" theme="danger" variant="text">移除</t-button>
                </t-popconfirm>
              </template>
            </t-table>
          </t-tab-panel>

          <t-tab-panel value="applications" label="入班申请">
            <div class="class-application-toolbar">
              <t-select
                v-model="applicationFilters.status"
                class="class-filter"
                @change="loadApplications"
              >
                <t-option label="全部申请" value="all" />
                <t-option label="待处理" value="pending" />
                <t-option label="已通过" value="approved" />
                <t-option label="已拒绝" value="rejected" />
              </t-select>
            </div>
            <t-table
              row-key="_id"
              :data="applicationRows"
              :columns="applicationColumns"
              :loading="detailLoading"
              :pagination="applicationPagination"
              size="medium"
              @page-change="handleApplicationPageChange"
            >
              <template #student="{ row }">
                <div class="class-member-cell">
                  <strong>{{ row.student_name || row.student_user_name || '未命名学生' }}</strong>
                  <span>{{ row.student_phone || row.student_openid || '--' }}</span>
                </div>
              </template>
              <template #status="{ row }">
                <t-tag :theme="getApplicationStatusTheme(row.status)" variant="light">
                  {{ getApplicationStatusLabel(row.status) }}
                </t-tag>
              </template>
              <template #create_time="{ row }">
                {{ formatDateTime(row.create_time) }}
              </template>
              <template #op="{ row }">
                <t-space v-if="row.status === 'pending'">
                  <t-popconfirm content="确认通过该入班申请？" @confirm="handleReviewApplication(row, 'approve')">
                    <t-button size="small" theme="primary" variant="text">通过</t-button>
                  </t-popconfirm>
                  <t-popconfirm content="确认拒绝该入班申请？" @confirm="handleReviewApplication(row, 'reject')">
                    <t-button size="small" theme="danger" variant="text">拒绝</t-button>
                  </t-popconfirm>
                </t-space>
                <span v-else>--</span>
              </template>
            </t-table>
          </t-tab-panel>
        </t-tabs>
      </div>
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import {
  createClass,
  deleteClass,
  getClassApplications,
  getClassMembers,
  getClasses,
  removeClassMember,
  reviewClassApplication,
  updateClass
} from '@/api/classes';
import { getProjects } from '@/api/projects';
import { getUsers } from '@/api/users';

const DEFAULT_FORM = {
  _id: '',
  class_name: '',
  class_code: '',
  teacher_openid: '',
  teacher_name: '',
  project_code: '',
  project_name: '',
  class_time: '',
  location: '',
  description: '',
  max_members: 50,
  status: 'active'
};

const columns = [
  { colKey: 'class_name', title: '班级', width: 190, fixed: 'left' },
  { colKey: 'project_name', title: '项目', width: 120 },
  { colKey: 'teacher_name', title: '教师', width: 140, ellipsis: true },
  { colKey: 'member_count', title: '成员', width: 100, align: 'right' },
  { colKey: 'pending_application_count', title: '待审批', width: 90, align: 'right' },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'class_time', title: '上课时间', minWidth: 150, ellipsis: true },
  { colKey: 'location', title: '地点', minWidth: 130, ellipsis: true },
  { colKey: 'update_time', title: '更新时间', width: 170 },
  { colKey: 'op', title: '操作', width: 190, fixed: 'right' }
];

const memberColumns = [
  { colKey: 'name', title: '成员', minWidth: 220 },
  { colKey: 'grade', title: '年级', width: 120 },
  { colKey: 'points', title: '积分/累计', width: 120, align: 'right' },
  { colKey: 'join_class_time', title: '入班时间', width: 170 },
  { colKey: 'op', title: '操作', width: 90 }
];

const applicationColumns = [
  { colKey: 'student', title: '学生', minWidth: 220 },
  { colKey: 'apply_reason', title: '申请理由', minWidth: 180, ellipsis: true },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'create_time', title: '申请时间', width: 170 },
  { colKey: 'op', title: '操作', width: 120 }
];

const rules = {
  class_name: [{ required: true, message: '请输入班级名称' }],
  project_code: [{ required: true, message: '请选择所属项目' }],
  teacher_openid: [{ required: true, message: '请选择班级教师' }],
  status: [{ required: true, message: '请选择状态' }]
};

const loading = ref(false);
const saving = ref(false);
const detailLoading = ref(false);
const formDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const formRef = ref(null);
const classRows = ref([]);
const projectOptions = ref([]);
const teacherOptions = ref([]);
const total = ref(0);
const selectedClass = ref(null);
const detailTab = ref('members');
const memberRows = ref([]);
const memberTotal = ref(0);
const applicationRows = ref([]);
const applicationTotal = ref(0);
const filters = reactive({
  keyword: '',
  project_code: '',
  status: '',
  page: 1,
  pageSize: 20
});
const memberFilters = reactive({
  page: 1,
  pageSize: 10
});
const applicationFilters = reactive({
  status: 'all',
  page: 1,
  pageSize: 10
});
const form = reactive(createDefaultForm());

const isEditing = computed(() => Boolean(form._id));
const pagination = computed(() => ({
  current: filters.page,
  pageSize: filters.pageSize,
  total: total.value,
  showJumper: true,
  pageSizeOptions: [10, 20, 50, 100]
}));
const memberPagination = computed(() => ({
  current: memberFilters.page,
  pageSize: memberFilters.pageSize,
  total: memberTotal.value,
  showJumper: true
}));
const applicationPagination = computed(() => ({
  current: applicationFilters.page,
  pageSize: applicationFilters.pageSize,
  total: applicationTotal.value,
  showJumper: true
}));

function createDefaultForm() {
  return { ...DEFAULT_FORM };
}

function resetForm(row = {}) {
  Object.assign(form, {
    ...createDefaultForm(),
    ...row,
    max_members: Number(row.max_members || DEFAULT_FORM.max_members),
    status: row.status === 'deleted' ? 'inactive' : row.status || 'active'
  });
}

function syncProjectName(projectCode) {
  const project = projectOptions.value.find((item) => item.project_code === projectCode);
  form.project_name = project?.project_name || '';
}

function syncTeacherName(openid) {
  const teacher = teacherOptions.value.find((item) => item._openid === openid);
  form.teacher_name = teacher ? getTeacherName(teacher) : '';
}

function getTeacherName(teacher) {
  return teacher.user_name || teacher.nick_name || teacher.nickname || '未命名教师';
}

function getTeacherOptionLabel(teacher) {
  const name = getTeacherName(teacher);
  return teacher.phone ? `${name} / ${teacher.phone}` : name;
}

function normalizePayload() {
  return {
    _id: form._id,
    class_name: form.class_name.trim(),
    class_code: form.class_code.trim().toUpperCase(),
    teacher_openid: form.teacher_openid,
    teacher_name: form.teacher_name,
    project_code: form.project_code,
    project_name: form.project_name,
    class_time: form.class_time.trim(),
    location: form.location.trim(),
    description: form.description.trim(),
    max_members: Number(form.max_members || 0),
    status: form.status
  };
}

function getStatusLabel(status) {
  const map = {
    active: '启用',
    inactive: '停用',
    deleted: '已删除'
  };
  return map[status] || '启用';
}

function getStatusTheme(status) {
  const map = {
    active: 'success',
    inactive: 'warning',
    deleted: 'danger'
  };
  return map[status] || 'success';
}

function getApplicationStatusLabel(status) {
  const map = {
    pending: '待处理',
    approved: '已通过',
    rejected: '已拒绝'
  };
  return map[status] || status;
}

function getApplicationStatusTheme(status) {
  const map = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  };
  return map[status] || 'default';
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

async function loadProjects() {
  try {
    const data = await getProjects({ status: 'active' });
    projectOptions.value = data.list || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '项目列表加载失败');
  }
}

async function loadTeachers() {
  try {
    const data = await getUsers({
      role: 'teacher',
      status: 'active',
      page: 1,
      page_size: 100
    });
    teacherOptions.value = data.list || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '教师列表加载失败');
  }
}

async function loadClasses() {
  loading.value = true;
  try {
    const data = await getClasses({
      keyword: filters.keyword.trim(),
      project_code: filters.project_code,
      status: filters.status,
      page: filters.page,
      page_size: filters.pageSize
    });
    classRows.value = data.list || [];
    total.value = data.total || 0;
  } catch (error) {
    MessagePlugin.error(error.message || '班级列表加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  filters.page = 1;
  loadClasses();
}

function handlePageChange(pageInfo) {
  filters.page = pageInfo.current || 1;
  filters.pageSize = pageInfo.pageSize || filters.pageSize;
  loadClasses();
}

function openCreateDialog() {
  resetForm();
  formDialogVisible.value = true;
}

function openEditDialog(row) {
  resetForm(row);
  formDialogVisible.value = true;
}

async function handleSubmit() {
  const validResult = await formRef.value?.validate();
  if (validResult !== true) {
    return;
  }

  saving.value = true;
  try {
    if (isEditing.value) {
      await updateClass(normalizePayload());
      MessagePlugin.success('班级已更新');
    } else {
      await createClass(normalizePayload());
      MessagePlugin.success('班级已创建');
    }

    formDialogVisible.value = false;
    await loadClasses();
  } catch (error) {
    MessagePlugin.error(error.message || '班级保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row) {
  loading.value = true;
  try {
    await deleteClass({
      class_id: row._id
    });
    MessagePlugin.success('班级已删除');
    await loadClasses();
  } catch (error) {
    MessagePlugin.error(error.message || '班级删除失败');
  } finally {
    loading.value = false;
  }
}

async function openDetailDialog(row) {
  selectedClass.value = row;
  detailTab.value = 'members';
  memberFilters.page = 1;
  applicationFilters.page = 1;
  detailDialogVisible.value = true;
  await loadMembers();
}

async function loadMembers() {
  if (!selectedClass.value) {
    return;
  }

  detailLoading.value = true;
  try {
    const data = await getClassMembers({
      class_id: selectedClass.value._id,
      page: memberFilters.page,
      page_size: memberFilters.pageSize
    });
    memberRows.value = data.list || [];
    memberTotal.value = data.total || 0;
  } catch (error) {
    MessagePlugin.error(error.message || '班级成员加载失败');
  } finally {
    detailLoading.value = false;
  }
}

async function loadApplications() {
  if (!selectedClass.value) {
    return;
  }

  detailLoading.value = true;
  try {
    const data = await getClassApplications({
      class_id: selectedClass.value._id,
      status: applicationFilters.status,
      page: applicationFilters.page,
      page_size: applicationFilters.pageSize
    });
    applicationRows.value = data.list || [];
    applicationTotal.value = data.total || 0;
  } catch (error) {
    MessagePlugin.error(error.message || '入班申请加载失败');
  } finally {
    detailLoading.value = false;
  }
}

function handleDetailTabChange(value) {
  if (value === 'members') {
    loadMembers();
  } else {
    loadApplications();
  }
}

function handleMemberPageChange(pageInfo) {
  memberFilters.page = pageInfo.current || 1;
  memberFilters.pageSize = pageInfo.pageSize || memberFilters.pageSize;
  loadMembers();
}

function handleApplicationPageChange(pageInfo) {
  applicationFilters.page = pageInfo.current || 1;
  applicationFilters.pageSize = pageInfo.pageSize || applicationFilters.pageSize;
  loadApplications();
}

async function handleRemoveMember(row) {
  if (!selectedClass.value) {
    return;
  }

  detailLoading.value = true;
  try {
    await removeClassMember({
      class_id: selectedClass.value._id,
      member_openid: row.member_openid
    });
    MessagePlugin.success('成员已移除');
    await Promise.all([loadMembers(), loadClasses()]);
  } catch (error) {
    MessagePlugin.error(error.message || '移除成员失败');
  } finally {
    detailLoading.value = false;
  }
}

async function handleReviewApplication(row, action) {
  detailLoading.value = true;
  try {
    await reviewClassApplication({
      application_id: row._id,
      review_action: action
    });
    MessagePlugin.success(action === 'approve' ? '申请已通过' : '申请已拒绝');
    await Promise.all([loadApplications(), loadClasses()]);
  } catch (error) {
    MessagePlugin.error(error.message || '处理申请失败');
  } finally {
    detailLoading.value = false;
  }
}

onMounted(() => {
  loadProjects();
  loadTeachers();
  loadClasses();
});
</script>
