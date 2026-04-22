<template>
  <section>
    <PageHeader
      eyebrow="Tasks"
      title="任务管理"
      description="统一维护公开任务和班级任务，支持运营筛选、发布状态调整和提交记录排查。"
    >
      <template #actions>
        <t-button variant="outline" :loading="loading" @click="loadTasks">刷新</t-button>
        <t-button theme="primary" @click="openCreateDialog">新增任务</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false" class="config-card">
      <div class="config-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索标题、说明、项目、班级或教师"
          class="task-search"
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-select
          v-model="filters.project_code"
          clearable
          placeholder="全部项目"
          class="task-filter"
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
          v-model="filters.task_type"
          clearable
          placeholder="全部类型"
          class="task-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option label="班级任务" value="class" />
          <t-option label="公开任务" value="public" />
        </t-select>
        <t-select
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          class="task-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option label="草稿" value="draft" />
          <t-option label="已发布" value="published" />
          <t-option label="已关闭" value="closed" />
        </t-select>
        <t-button :loading="loading" @click="handleSearch">查询</t-button>
      </div>

      <t-table
        row-key="_id"
        :data="taskRows"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        hover
        @page-change="handlePageChange"
      >
        <template #title="{ row }">
          <div class="task-title-cell">
            <strong>{{ row.title }}</strong>
            <span>{{ row.category || '未分类' }}</span>
          </div>
        </template>

        <template #project_name="{ row }">
          <t-tag theme="primary" variant="light">{{ row.project_name || row.project_code || '--' }}</t-tag>
        </template>

        <template #task_type="{ row }">
          <div class="task-type-cell">
            <t-tag :theme="row.task_type === 'class' ? 'warning' : 'success'" variant="light">
              {{ getTaskTypeLabel(row.task_type) }}
            </t-tag>
            <span>{{ row.task_type === 'class' ? row.class_name || '--' : getVisibilityLabel(row.visibility) }}</span>
          </div>
        </template>

        <template #difficulty="{ row }">
          <span>{{ row.difficulty || 1 }} 级 / {{ row.points || 0 }} 分</span>
        </template>

        <template #submissions="{ row }">
          <span>{{ row.submission_count || 0 }} 次</span>
          <t-tag :theme="row.pending_submission_count ? 'warning' : 'default'" variant="light">
            待审 {{ row.pending_submission_count || 0 }}
          </t-tag>
        </template>

        <template #status="{ row }">
          <t-tag :theme="getStatusTheme(row.status)" variant="light">
            {{ getStatusLabel(row.status) }}
          </t-tag>
        </template>

        <template #deadline="{ row }">
          {{ formatDeadline(row) }}
        </template>

        <template #update_time="{ row }">
          {{ formatDateTime(row.update_time || row.create_time) }}
        </template>

        <template #op="{ row }">
          <t-space>
            <t-button size="small" variant="text" @click="openDetailDialog(row)">查看</t-button>
            <t-button size="small" variant="text" @click="openEditDialog(row)">编辑</t-button>
            <t-popconfirm content="删除任务会关闭任务并隐藏在小程序列表中，已有提交记录会保留，确认继续？" @confirm="handleDelete(row)">
              <t-button size="small" theme="danger" variant="text">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog
      v-model:visible="formDialogVisible"
      :header="isEditing ? '编辑任务' : '新增任务'"
      width="860px"
      :confirm-btn="{ content: isEditing ? '保存修改' : '创建任务', loading: saving }"
      :cancel-btn="{ content: '取消' }"
      @confirm="handleSubmit"
    >
      <t-form ref="formRef" :data="form" :rules="rules" label-width="112px">
        <t-form-item label="任务标题" name="title">
          <t-input v-model="form.title" placeholder="例如 变量与条件语句练习" />
        </t-form-item>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="任务类型" name="task_type">
              <t-select v-model="form.task_type" placeholder="请选择类型" @change="handleTaskTypeChange">
                <t-option label="班级任务" value="class" />
                <t-option label="公开任务" value="public" />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="状态" name="status">
              <t-select v-model="form.status" placeholder="请选择状态">
                <t-option label="草稿" value="draft" />
                <t-option label="已发布" value="published" />
                <t-option label="已关闭" value="closed" />
              </t-select>
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col v-if="form.task_type === 'class'" :span="6">
            <t-form-item label="所属班级" name="class_id">
              <t-select
                v-model="form.class_id"
                filterable
                placeholder="请选择班级"
                @change="syncClassInfo"
              >
                <t-option
                  v-for="classInfo in classOptions"
                  :key="classInfo._id"
                  :label="getClassOptionLabel(classInfo)"
                  :value="classInfo._id"
                />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="所属项目" name="project_code">
              <t-select
                v-model="form.project_code"
                :disabled="form.task_type === 'class'"
                placeholder="请选择项目"
                @change="syncProjectInfo"
              >
                <t-option
                  v-for="project in projectOptions"
                  :key="project.project_code"
                  :label="project.project_name"
                  :value="project.project_code"
                />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col v-if="form.task_type === 'public'" :span="6">
            <t-form-item label="负责教师" name="teacher_openid">
              <t-select
                v-model="form.teacher_openid"
                filterable
                placeholder="请选择负责教师"
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
            <t-form-item label="任务分类" name="category">
              <t-select
                v-model="form.category"
                filterable
                creatable
                clearable
                placeholder="选择或输入分类"
              >
                <t-option
                  v-for="category in categoryOptions"
                  :key="category"
                  :label="category"
                  :value="category"
                />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="3">
            <t-form-item label="难度" name="difficulty">
              <t-input-number v-model="form.difficulty" :min="1" :max="5" theme="normal" />
            </t-form-item>
          </t-col>
          <t-col :span="3">
            <t-form-item label="积分" name="points">
              <t-input-number v-model="form.points" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="4">
            <t-form-item label="可见范围" name="visibility">
              <t-select v-model="form.visibility" :disabled="form.task_type === 'public'">
                <t-option label="仅班级成员" value="class_only" />
                <t-option label="公开可见" value="public" />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="4">
            <t-form-item label="截止日期" name="deadline_date">
              <t-input v-model="form.deadline_date" placeholder="YYYY-MM-DD，可为空" />
            </t-form-item>
          </t-col>
          <t-col :span="4">
            <t-form-item label="截止时间" name="deadline_time">
              <t-input v-model="form.deadline_time" placeholder="HH:mm，可为空" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="最大提交" name="max_submissions">
              <t-input-number v-model="form.max_submissions" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="封面图" name="cover_image">
              <t-input v-model="form.cover_image" placeholder="可填写 cloud:// 或 https:// 图片地址" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="任务说明" name="description">
          <t-textarea
            v-model="form.description"
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder="任务要求、提交标准、评分说明等"
          />
        </t-form-item>

        <t-form-item label="任务图片" name="images">
          <div class="task-editor-list">
            <div
              v-for="(item, index) in form.images"
              :key="`image-${index}`"
              class="task-editor-row"
            >
              <t-input v-model="form.images[index]" placeholder="cloud:// 或 https:// 图片地址" />
              <t-button theme="danger" variant="text" @click="removeImage(index)">删除</t-button>
            </div>
            <t-button variant="outline" block @click="addImage">新增图片</t-button>
          </div>
        </t-form-item>

        <t-form-item label="任务附件" name="files">
          <div class="task-editor-list">
            <div
              v-for="(item, index) in form.files"
              :key="`file-${index}`"
              class="task-file-row"
            >
              <t-input v-model="item.file_id" placeholder="file_id / cloud:// 文件地址" />
              <t-input v-model="item.file_name" placeholder="文件名" />
              <t-input-number v-model="item.file_size" :min="0" theme="normal" />
              <t-button theme="danger" variant="text" @click="removeFile(index)">删除</t-button>
            </div>
            <t-button variant="outline" block @click="addFile">新增附件</t-button>
          </div>
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="detailDialogVisible"
      header="任务详情"
      width="940px"
      :footer="false"
    >
      <div v-if="selectedTask" class="task-detail">
        <div class="task-detail-summary">
          <div>
            <span>任务</span>
            <strong>{{ selectedTask.title }}</strong>
          </div>
          <div>
            <span>类型</span>
            <strong>{{ getTaskTypeLabel(selectedTask.task_type) }}</strong>
          </div>
          <div>
            <span>提交</span>
            <strong>{{ selectedTask.submission_count || 0 }} 次</strong>
          </div>
          <div>
            <span>待审核</span>
            <strong>{{ selectedTask.pending_submission_count || 0 }}</strong>
          </div>
        </div>

        <t-tabs v-model="detailTab" @change="handleDetailTabChange">
          <t-tab-panel value="info" label="任务信息">
            <div class="task-info-grid">
              <div>
                <span>项目</span>
                <strong>{{ selectedTask.project_name || selectedTask.project_code || '--' }}</strong>
              </div>
              <div>
                <span>班级</span>
                <strong>{{ selectedTask.class_name || '--' }}</strong>
              </div>
              <div>
                <span>教师</span>
                <strong>{{ selectedTask.teacher_name || selectedTask.teacher_openid || '--' }}</strong>
              </div>
              <div>
                <span>难度 / 积分</span>
                <strong>{{ selectedTask.difficulty || 1 }} 级 / {{ selectedTask.points || 0 }} 分</strong>
              </div>
              <div>
                <span>截止时间</span>
                <strong>{{ formatDeadline(selectedTask) }}</strong>
              </div>
              <div>
                <span>状态</span>
                <strong>{{ getStatusLabel(selectedTask.status) }}</strong>
              </div>
            </div>
            <div class="task-description-panel">
              {{ selectedTask.description || '暂无任务说明' }}
            </div>
          </t-tab-panel>

          <t-tab-panel value="submissions" label="提交记录">
            <div class="task-submission-toolbar">
              <t-select
                v-model="submissionFilters.status"
                class="task-filter"
                @change="loadSubmissions"
              >
                <t-option label="全部提交" value="all" />
                <t-option label="待审核" value="pending" />
                <t-option label="已通过" value="approved" />
                <t-option label="已拒绝" value="rejected" />
              </t-select>
            </div>
            <t-table
              row-key="_id"
              :data="submissionRows"
              :columns="submissionColumns"
              :loading="detailLoading"
              :pagination="submissionPagination"
              size="medium"
              @page-change="handleSubmissionPageChange"
            >
              <template #student="{ row }">
                <div class="task-title-cell">
                  <strong>{{ row.student_name || '未命名学生' }}</strong>
                  <span>{{ row.class_name || row.student_openid || '--' }}</span>
                </div>
              </template>
              <template #status="{ row }">
                <t-tag :theme="getSubmissionStatusTheme(row.status)" variant="light">
                  {{ getSubmissionStatusLabel(row.status) }}
                </t-tag>
              </template>
              <template #material="{ row }">
                图片 {{ (row.images || []).length }} / 附件 {{ (row.files || []).length }}
              </template>
              <template #score="{ row }">
                {{ row.score ?? '--' }} / {{ row.points_earned || 0 }} 分
              </template>
              <template #submit_time="{ row }">
                {{ formatDateTime(row.submit_time || row.create_time) }}
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
import { getClasses } from '@/api/classes';
import { getProjects } from '@/api/projects';
import {
  createTask,
  deleteTask,
  getTaskDetail,
  getTasks,
  getTaskSubmissions,
  updateTask
} from '@/api/tasks';
import { getUsers } from '@/api/users';

const DEFAULT_FORM = {
  _id: '',
  title: '',
  description: '',
  cover_image: '',
  images: [],
  files: [],
  project_code: '',
  project_name: '',
  category: '',
  difficulty: 1,
  points: 10,
  max_submissions: 0,
  deadline_date: '',
  deadline_time: '',
  task_type: 'class',
  visibility: 'class_only',
  class_id: '',
  class_name: '',
  teacher_openid: '',
  teacher_name: '',
  status: 'draft'
};

const columns = [
  { colKey: 'title', title: '任务', width: 220, fixed: 'left' },
  { colKey: 'project_name', title: '项目', width: 120 },
  { colKey: 'task_type', title: '类型/范围', width: 150 },
  { colKey: 'teacher_name', title: '教师', width: 130, ellipsis: true },
  { colKey: 'difficulty', title: '难度/积分', width: 120 },
  { colKey: 'submissions', title: '提交', width: 140 },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'deadline', title: '截止时间', width: 150 },
  { colKey: 'update_time', title: '更新时间', width: 170 },
  { colKey: 'op', title: '操作', width: 190, fixed: 'right' }
];

const submissionColumns = [
  { colKey: 'student', title: '学生', minWidth: 210 },
  { colKey: 'submit_no', title: '次数', width: 80, align: 'right' },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'material', title: '材料', width: 130 },
  { colKey: 'score', title: '评分/积分', width: 120 },
  { colKey: 'submit_time', title: '提交时间', width: 170 }
];

const rules = {
  title: [{ required: true, message: '请输入任务标题' }],
  task_type: [{ required: true, message: '请选择任务类型' }],
  status: [{ required: true, message: '请选择任务状态' }]
};

const loading = ref(false);
const saving = ref(false);
const detailLoading = ref(false);
const formDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const formRef = ref(null);
const taskRows = ref([]);
const projectOptions = ref([]);
const classOptions = ref([]);
const teacherOptions = ref([]);
const total = ref(0);
const selectedTask = ref(null);
const detailTab = ref('info');
const submissionRows = ref([]);
const submissionTotal = ref(0);
const filters = reactive({
  keyword: '',
  project_code: '',
  task_type: '',
  status: '',
  page: 1,
  pageSize: 20
});
const submissionFilters = reactive({
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
const submissionPagination = computed(() => ({
  current: submissionFilters.page,
  pageSize: submissionFilters.pageSize,
  total: submissionTotal.value,
  showJumper: true
}));
const categoryOptions = computed(() => {
  const project = projectOptions.value.find((item) => item.project_code === form.project_code);
  const categories = Array.isArray(project?.task_categories) ? project.task_categories : [];
  return categories.length ? categories : ['基础训练'];
});

function createDefaultForm() {
  return {
    ...DEFAULT_FORM,
    images: [],
    files: []
  };
}

function resetForm(row = {}) {
  Object.assign(form, {
    ...createDefaultForm(),
    ...row,
    difficulty: Number(row.difficulty || DEFAULT_FORM.difficulty),
    points: Number(row.points ?? DEFAULT_FORM.points),
    max_submissions: Number(row.max_submissions || 0),
    deadline_date: normalizeDateText(row.deadline_date),
    deadline_time: normalizeTimeText(row.deadline_time),
    task_type: row.task_type || DEFAULT_FORM.task_type,
    visibility: row.visibility || (row.task_type === 'public' ? 'public' : DEFAULT_FORM.visibility),
    status: row.status || DEFAULT_FORM.status,
    images: cloneImages(row.images),
    files: cloneFiles(row.files)
  });
}

function cloneImages(images) {
  return Array.isArray(images) ? images.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function cloneFiles(files) {
  if (!Array.isArray(files)) {
    return [];
  }

  return files.map((item) => ({
    file_id: String(item.file_id || '').trim(),
    file_name: String(item.file_name || '').trim(),
    file_size: Number(item.file_size || 0)
  }));
}

function addImage() {
  form.images.push('');
}

function removeImage(index) {
  form.images.splice(index, 1);
}

function addFile() {
  form.files.push({
    file_id: '',
    file_name: '',
    file_size: 0
  });
}

function removeFile(index) {
  form.files.splice(index, 1);
}

function normalizeDateText(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }

  return String(value || '').trim().slice(0, 10);
}

function normalizeTimeText(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  return String(value || '').trim().slice(0, 5);
}

function getTaskTypeLabel(taskType) {
  return taskType === 'public' ? '公开任务' : '班级任务';
}

function getVisibilityLabel(visibility) {
  return visibility === 'public' ? '公开可见' : '仅班级成员';
}

function getStatusLabel(status) {
  const map = {
    draft: '草稿',
    published: '已发布',
    closed: '已关闭'
  };
  return map[status] || '草稿';
}

function getStatusTheme(status) {
  const map = {
    draft: 'default',
    published: 'success',
    closed: 'danger'
  };
  return map[status] || 'default';
}

function getSubmissionStatusLabel(status) {
  const map = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝'
  };
  return map[status] || status;
}

function getSubmissionStatusTheme(status) {
  const map = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  };
  return map[status] || 'default';
}

function getTeacherName(teacher) {
  return teacher.user_name || teacher.nick_name || teacher.nickname || '未命名教师';
}

function getTeacherOptionLabel(teacher) {
  const name = getTeacherName(teacher);
  return teacher.phone ? `${name} / ${teacher.phone}` : name;
}

function getClassOptionLabel(classInfo) {
  const projectName = classInfo.project_name || classInfo.project_code || '未分配项目';
  return `${classInfo.class_name} / ${projectName}`;
}

function formatDeadline(row) {
  if (row.deadline_date && row.deadline_time) {
    return `${row.deadline_date} ${row.deadline_time}`;
  }

  return '--';
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

function syncProjectInfo(projectCode) {
  const project = projectOptions.value.find((item) => item.project_code === projectCode);
  form.project_name = project?.project_name || '';
  if (!form.category && categoryOptions.value.length) {
    form.category = categoryOptions.value[0];
  }
}

function syncTeacherName(openid) {
  const teacher = teacherOptions.value.find((item) => item._openid === openid);
  form.teacher_name = teacher ? getTeacherName(teacher) : '';
}

function syncClassInfo(classId) {
  const classInfo = classOptions.value.find((item) => item._id === classId);
  if (!classInfo) {
    return;
  }

  form.class_name = classInfo.class_name || '';
  form.project_code = classInfo.project_code || '';
  form.project_name = classInfo.project_name || '';
  form.teacher_openid = classInfo.teacher_openid || '';
  form.teacher_name = classInfo.teacher_name || '';
  if (!form.category && categoryOptions.value.length) {
    form.category = categoryOptions.value[0];
  }
}

function handleTaskTypeChange(value) {
  if (value === 'public') {
    form.class_id = '';
    form.class_name = '';
    form.visibility = 'public';
    return;
  }

  form.teacher_openid = '';
  form.teacher_name = '';
  form.visibility = 'class_only';
}

function normalizeFiles() {
  return form.files
    .map((item) => ({
      file_id: String(item.file_id || '').trim(),
      file_name: String(item.file_name || '').trim(),
      file_size: Number(item.file_size || 0)
    }))
    .filter((item) => item.file_id);
}

function validatePayload() {
  if (!String(form.title || '').trim()) {
    throw new Error('请输入任务标题');
  }

  if (form.task_type === 'class' && !form.class_id) {
    throw new Error('班级任务必须选择所属班级');
  }

  if (form.task_type === 'public' && !form.teacher_openid) {
    throw new Error('公开任务必须选择负责教师');
  }

  if (!form.project_code) {
    throw new Error('请选择所属项目');
  }

  if ((form.deadline_date && !form.deadline_time) || (!form.deadline_date && form.deadline_time)) {
    throw new Error('截止日期和截止时间需要同时填写');
  }
}

function normalizePayload() {
  validatePayload();

  return {
    _id: form._id,
    title: String(form.title || '').trim(),
    description: String(form.description || '').trim(),
    cover_image: String(form.cover_image || '').trim(),
    images: form.images.map((item) => String(item || '').trim()).filter(Boolean),
    files: normalizeFiles(),
    project_code: form.project_code,
    project_name: form.project_name,
    category: String(form.category || '').trim(),
    difficulty: Number(form.difficulty || 1),
    points: Number(form.points || 0),
    max_submissions: Number(form.max_submissions || 0),
    deadline_date: String(form.deadline_date || '').trim(),
    deadline_time: String(form.deadline_time || '').trim(),
    task_type: form.task_type,
    visibility: form.task_type === 'public' ? 'public' : form.visibility,
    class_id: form.task_type === 'class' ? form.class_id : '',
    class_name: form.task_type === 'class' ? form.class_name : '',
    teacher_openid: form.teacher_openid,
    teacher_name: form.teacher_name,
    status: form.status
  };
}

async function loadProjects() {
  try {
    const data = await getProjects({ status: 'active' });
    projectOptions.value = data.list || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '项目列表加载失败');
  }
}

async function loadClasses() {
  try {
    const data = await getClasses({
      page: 1,
      page_size: 100
    });
    classOptions.value = data.list || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '班级列表加载失败');
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

async function loadTasks() {
  loading.value = true;
  try {
    const data = await getTasks({
      keyword: filters.keyword.trim(),
      project_code: filters.project_code,
      task_type: filters.task_type,
      status: filters.status,
      page: filters.page,
      page_size: filters.pageSize
    });
    taskRows.value = data.list || [];
    total.value = data.total || 0;
  } catch (error) {
    MessagePlugin.error(error.message || '任务列表加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  filters.page = 1;
  loadTasks();
}

function handlePageChange(pageInfo) {
  filters.page = pageInfo.current || 1;
  filters.pageSize = pageInfo.pageSize || filters.pageSize;
  loadTasks();
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
    const payload = normalizePayload();
    if (isEditing.value) {
      await updateTask(payload);
      MessagePlugin.success('任务已更新');
    } else {
      await createTask(payload);
      MessagePlugin.success('任务已创建');
    }

    formDialogVisible.value = false;
    await loadTasks();
  } catch (error) {
    MessagePlugin.error(error.message || '任务保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row) {
  loading.value = true;
  try {
    await deleteTask({
      task_id: row._id
    });
    MessagePlugin.success('任务已删除');
    await loadTasks();
  } catch (error) {
    MessagePlugin.error(error.message || '任务删除失败');
  } finally {
    loading.value = false;
  }
}

async function openDetailDialog(row) {
  detailLoading.value = true;
  detailDialogVisible.value = true;
  detailTab.value = 'info';
  submissionFilters.page = 1;
  selectedTask.value = row;
  try {
    const data = await getTaskDetail(row._id);
    selectedTask.value = data.task || row;
  } catch (error) {
    MessagePlugin.warning(error.message || '任务详情加载失败，已展示列表数据');
  } finally {
    detailLoading.value = false;
  }
}

async function loadSubmissions() {
  if (!selectedTask.value) {
    return;
  }

  detailLoading.value = true;
  try {
    const data = await getTaskSubmissions({
      task_id: selectedTask.value._id,
      status: submissionFilters.status,
      page: submissionFilters.page,
      page_size: submissionFilters.pageSize
    });
    submissionRows.value = data.list || [];
    submissionTotal.value = data.total || 0;
  } catch (error) {
    MessagePlugin.error(error.message || '提交记录加载失败');
  } finally {
    detailLoading.value = false;
  }
}

function handleDetailTabChange(value) {
  if (value === 'submissions') {
    loadSubmissions();
  }
}

function handleSubmissionPageChange(pageInfo) {
  submissionFilters.page = pageInfo.current || 1;
  submissionFilters.pageSize = pageInfo.pageSize || submissionFilters.pageSize;
  loadSubmissions();
}

onMounted(() => {
  loadProjects();
  loadClasses();
  loadTeachers();
  loadTasks();
});
</script>
