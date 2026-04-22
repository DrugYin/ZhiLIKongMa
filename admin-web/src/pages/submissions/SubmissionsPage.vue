<template>
  <section>
    <PageHeader
      eyebrow="Submissions"
      title="提交记录"
      description="集中查看学生提交、附件材料和审核结果，支持后台直接通过、驳回或重置为待审核。"
    >
      <template #actions>
        <t-button variant="outline" :loading="loading" @click="loadSubmissions">刷新</t-button>
      </template>
    </PageHeader>

    <div class="submission-stat-grid">
      <t-card :bordered="false" class="submission-stat-card">
        <span>当前筛选</span>
        <strong>{{ pagination.total }}</strong>
        <em>条提交记录</em>
      </t-card>
      <t-card :bordered="false" class="submission-stat-card">
        <span>待审核</span>
        <strong>{{ summary.pending || 0 }}</strong>
        <em>需要处理</em>
      </t-card>
      <t-card :bordered="false" class="submission-stat-card">
        <span>已通过</span>
        <strong>{{ summary.approved || 0 }}</strong>
        <em>已发放积分</em>
      </t-card>
      <t-card :bordered="false" class="submission-stat-card">
        <span>超时提交</span>
        <strong>{{ summary.overtime || 0 }}</strong>
        <em>需重点关注</em>
      </t-card>
    </div>

    <t-card :bordered="false" class="config-card submission-card">
      <div class="config-toolbar submission-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索任务、学生、班级、教师或提交说明"
          class="submission-search"
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-select
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          class="submission-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option label="待审核" value="pending" />
          <t-option label="已通过" value="approved" />
          <t-option label="已驳回" value="rejected" />
        </t-select>
        <t-select
          v-model="filters.project_code"
          clearable
          placeholder="全部项目"
          class="submission-filter"
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
          v-model="filters.class_id"
          clearable
          filterable
          placeholder="全部班级"
          class="submission-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option
            v-for="classInfo in classOptions"
            :key="classInfo._id"
            :label="classInfo.class_name"
            :value="classInfo._id"
          />
        </t-select>
        <t-select
          v-model="filters.overtime"
          clearable
          placeholder="提交时效"
          class="submission-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option label="超时提交" value="yes" />
          <t-option label="按时提交" value="no" />
        </t-select>
        <t-button :loading="loading" @click="handleSearch">查询</t-button>
      </div>

      <div class="submission-table-shell">
        <t-table
          row-key="_id"
          class="submission-table"
          :data="submissionRows"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          hover
          @page-change="handlePageChange"
        >
          <template #task="{ row }">
            <div class="submission-title-cell">
              <strong>{{ row.task_title || '--' }}</strong>
              <span>{{ row.project_name || row.project_code || '--' }}</span>
            </div>
          </template>

          <template #student="{ row }">
            <div class="submission-title-cell">
              <strong>{{ row.student_name || '未命名学生' }}</strong>
              <span>{{ row.class_name || row.student_openid || '--' }}</span>
            </div>
          </template>

          <template #status="{ row }">
            <t-space size="small" break-line>
              <t-tag :theme="getStatusTheme(row.status)" variant="light">
                {{ getStatusLabel(row.status) }}
              </t-tag>
              <t-tag v-if="row.is_overtime" theme="warning" variant="light">超时</t-tag>
            </t-space>
          </template>

          <template #materials="{ row }">
            图片 {{ (row.images || []).length }} / 附件 {{ (row.files || []).length }}
          </template>

          <template #score="{ row }">
            {{ row.score ?? '--' }} / {{ row.points_earned || 0 }} 分
          </template>

          <template #submit_time="{ row }">
            {{ formatDateTime(row.submit_time || row.create_time) }}
          </template>

          <template #op="{ row }">
            <t-space>
              <t-button size="small" variant="text" @click="openDetailDialog(row)">查看</t-button>
              <t-button size="small" variant="text" @click="openReviewDialog(row)">审核</t-button>
            </t-space>
          </template>
        </t-table>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="detailDialogVisible"
      header="提交详情"
      width="920px"
      :footer="false"
    >
      <div v-if="selectedSubmission" class="submission-detail">
        <div class="submission-detail-summary">
          <div>
            <span>任务</span>
            <strong>{{ selectedSubmission.task_title || '--' }}</strong>
          </div>
          <div>
            <span>学生</span>
            <strong>{{ selectedSubmission.student_name || '--' }}</strong>
          </div>
          <div>
            <span>状态</span>
            <strong>{{ getStatusLabel(selectedSubmission.status) }}</strong>
          </div>
          <div>
            <span>积分</span>
            <strong>{{ selectedSubmission.points_earned || 0 }} 分</strong>
          </div>
        </div>

        <div class="submission-info-grid">
          <div>
            <span>项目</span>
            <strong>{{ selectedSubmission.project_name || selectedSubmission.project_code || '--' }}</strong>
          </div>
          <div>
            <span>班级</span>
            <strong>{{ selectedSubmission.class_name || '--' }}</strong>
          </div>
          <div>
            <span>教师</span>
            <strong>{{ selectedSubmission.teacher_name || selectedSubmission.teacher_openid || '--' }}</strong>
          </div>
          <div>
            <span>提交时间</span>
            <strong>{{ formatDateTime(selectedSubmission.submit_time || selectedSubmission.create_time) }}</strong>
          </div>
          <div>
            <span>提交次数</span>
            <strong>第 {{ selectedSubmission.submit_no || 1 }} 次</strong>
          </div>
          <div>
            <span>审核时间</span>
            <strong>{{ formatDateTime(selectedSubmission.review_time) }}</strong>
          </div>
        </div>

        <section class="submission-section">
          <h3>提交说明</h3>
          <p>{{ selectedSubmission.description || '暂无提交说明' }}</p>
        </section>

        <section class="submission-section">
          <h3>提交资源</h3>
          <div v-if="hasResources(selectedSubmission)" class="submission-resource-list">
            <div
              v-for="(image, index) in selectedSubmission.images || []"
              :key="`image-${index}`"
              class="submission-image-card"
            >
              <img
                v-if="getResourceURLSync(image)"
                :src="getResourceURLSync(image)"
                :alt="`提交图片 ${index + 1}`"
              />
              <div v-else class="submission-image-placeholder">图片地址待解析</div>
              <div>
                <span>图片 {{ index + 1 }}</span>
                <strong>{{ image }}</strong>
              </div>
              <t-button size="small" variant="text" @click="downloadResource(image, `提交图片-${index + 1}`)">下载</t-button>
            </div>
            <div
              v-for="(file, index) in selectedSubmission.files || []"
              :key="`file-${index}`"
              class="submission-file-card"
            >
              <span>{{ file.file_name || `附件 ${index + 1}` }}</span>
              <strong>{{ file.file_id }}</strong>
              <em>{{ formatFileSize(file.file_size) }}</em>
              <t-button size="small" variant="text" @click="downloadResource(file.file_id, file.file_name || `提交附件-${index + 1}`)">下载</t-button>
            </div>
          </div>
          <t-empty v-else title="暂无资源" description="该提交没有上传图片或附件。" />
        </section>

        <section class="submission-section">
          <h3>审核结果</h3>
          <p>{{ selectedSubmission.feedback || '暂无审核反馈' }}</p>
          <div v-if="hasFeedbackResources(selectedSubmission)" class="submission-resource-list">
            <div
              v-for="(image, index) in selectedSubmission.feedback_images || []"
              :key="`feedback-image-${index}`"
              class="submission-image-card"
            >
              <img
                v-if="getResourceURLSync(image)"
                :src="getResourceURLSync(image)"
                :alt="`反馈图片 ${index + 1}`"
              />
              <div v-else class="submission-image-placeholder">图片地址待解析</div>
              <div>
                <span>反馈图片 {{ index + 1 }}</span>
                <strong>{{ image }}</strong>
              </div>
              <t-button size="small" variant="text" @click="downloadResource(image, `反馈图片-${index + 1}`)">下载</t-button>
            </div>
            <div
              v-for="(file, index) in selectedSubmission.feedback_files || []"
              :key="`feedback-file-${index}`"
              class="submission-file-card"
            >
              <span>{{ file.file_name || `反馈附件 ${index + 1}` }}</span>
              <strong>{{ file.file_id }}</strong>
              <em>{{ formatFileSize(file.file_size) }}</em>
              <t-button size="small" variant="text" @click="downloadResource(file.file_id, file.file_name || `反馈附件-${index + 1}`)">下载</t-button>
            </div>
          </div>
        </section>

        <div class="submission-detail-actions">
          <t-button theme="primary" @click="openReviewDialog(selectedSubmission)">处理审核</t-button>
        </div>
      </div>
    </t-dialog>

    <t-dialog
      v-model:visible="reviewDialogVisible"
      header="审核提交"
      width="680px"
      :confirm-btn="{ content: '保存审核', loading: saving }"
      :cancel-btn="{ content: '取消' }"
      @confirm="handleReviewSubmit"
    >
      <t-form ref="reviewFormRef" :data="reviewForm" :rules="reviewRules" label-width="100px">
        <t-form-item label="审核状态" name="status">
          <t-radio-group v-model="reviewForm.status">
            <t-radio-button value="approved">通过</t-radio-button>
            <t-radio-button value="rejected">驳回</t-radio-button>
            <t-radio-button value="pending">待审核</t-radio-button>
          </t-radio-group>
        </t-form-item>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="评分" name="score">
              <t-input-number v-model="reviewForm.score" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="获得积分" name="points_earned">
              <t-input-number
                v-model="reviewForm.points_earned"
                :min="0"
                theme="normal"
                :disabled="reviewForm.status !== 'approved'"
              />
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="反馈" name="feedback">
          <t-textarea
            v-model="reviewForm.feedback"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder="填写给学生的审核意见"
          />
        </t-form-item>
      </t-form>
      <t-alert
        theme="warning"
        message="如果把已通过记录改为驳回或待审核，后台会自动扣回本次已发放积分。"
      />
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { getClasses } from '@/api/classes';
import { getProjects } from '@/api/projects';
import { getSubmissionDetail, getSubmissions, reviewSubmission } from '@/api/submissions';
import { isCloudFileID, isWebURL, resolveCloudFileURLs } from '@/api/cloudbase';

const columns = [
  { colKey: 'task', title: '任务', width: 220 },
  { colKey: 'student', title: '学生', width: 180 },
  { colKey: 'teacher_name', title: '教师', width: 120, ellipsis: true },
  { colKey: 'status', title: '状态', width: 120 },
  { colKey: 'materials', title: '材料', width: 120 },
  { colKey: 'score', title: '评分/积分', width: 120 },
  { colKey: 'submit_time', title: '提交时间', width: 170 },
  { colKey: 'op', title: '操作', width: 120 }
];

const loading = ref(false);
const saving = ref(false);
const detailDialogVisible = ref(false);
const reviewDialogVisible = ref(false);
const reviewFormRef = ref(null);
const submissionRows = ref([]);
const submissionTotal = ref(0);
const selectedSubmission = ref(null);
const projectOptions = ref([]);
const classOptions = ref([]);
const summary = reactive({
  pending: 0,
  approved: 0,
  rejected: 0,
  overtime: 0
});
const resourceURLMap = reactive({});

const filters = reactive({
  keyword: '',
  status: '',
  project_code: '',
  class_id: '',
  overtime: '',
  page: 1,
  pageSize: 20
});

const reviewForm = reactive({
  submission_id: '',
  status: 'approved',
  score: null,
  points_earned: 0,
  feedback: ''
});

const reviewRules = {
  status: [{ required: true, message: '请选择审核状态' }]
};

const pagination = computed(() => ({
  current: filters.page,
  pageSize: filters.pageSize,
  total: submissionTotal.value,
  showJumper: true,
  showPageSize: true
}));

function resetSummary(data = {}) {
  summary.pending = data.pending || 0;
  summary.approved = data.approved || 0;
  summary.rejected = data.rejected || 0;
  summary.overtime = data.overtime || 0;
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

function formatFileSize(size) {
  const value = Number(size || 0);
  if (!value) {
    return '--';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getStatusLabel(status) {
  const map = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回'
  };
  return map[status] || status || '--';
}

function getStatusTheme(status) {
  const map = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  };
  return map[status] || 'default';
}

function getResourceFileIDs(source = selectedSubmission.value) {
  if (!source) {
    return [];
  }

  return [
    ...(source.images || []),
    ...(source.files || []).map((item) => item.file_id),
    ...(source.feedback_images || []),
    ...(source.feedback_files || []).map((item) => item.file_id)
  ].filter(isCloudFileID);
}

async function resolveResourceURLs(fileIDs = getResourceFileIDs()) {
  const ids = Array.from(new Set(fileIDs.filter(isCloudFileID)));
  if (!ids.length) {
    return {};
  }

  const resolvedMap = await resolveCloudFileURLs(ids, 3600);
  Object.assign(resourceURLMap, resolvedMap);
  return resolvedMap;
}

function getResourceURLSync(value) {
  const resource = String(value || '').trim();
  if (!resource) {
    return '';
  }

  if (isWebURL(resource)) {
    return resource;
  }

  return resourceURLMap[resource] || '';
}

async function getResourceURL(value) {
  const resource = String(value || '').trim();
  if (!resource) {
    return '';
  }

  if (isWebURL(resource)) {
    return resource;
  }

  if (!isCloudFileID(resource)) {
    return '';
  }

  if (!resourceURLMap[resource]) {
    await resolveResourceURLs([resource]);
  }

  return resourceURLMap[resource] || '';
}

async function downloadResource(value, filename = 'resource') {
  const url = await getResourceURL(value);
  if (!url) {
    MessagePlugin.warning('暂时无法获取资源下载地址');
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function hasResources(row = {}) {
  return Boolean((row.images || []).length || (row.files || []).length);
}

function hasFeedbackResources(row = {}) {
  return Boolean((row.feedback_images || []).length || (row.feedback_files || []).length);
}

async function loadProjects() {
  try {
    const data = await getProjects({ page_size: 100 });
    projectOptions.value = data.list || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '项目选项加载失败');
  }
}

async function loadClasses() {
  try {
    const data = await getClasses({ page_size: 100 });
    classOptions.value = data.list || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '班级选项加载失败');
  }
}

async function loadSubmissions() {
  loading.value = true;
  try {
    const data = await getSubmissions({
      keyword: filters.keyword,
      status: filters.status,
      project_code: filters.project_code,
      class_id: filters.class_id,
      overtime: filters.overtime,
      page: filters.page,
      page_size: filters.pageSize
    });
    submissionRows.value = data.list || [];
    submissionTotal.value = data.total || 0;
    resetSummary(data.summary || {});
    await resolveResourceURLs(submissionRows.value.flatMap((item) => getResourceFileIDs(item)));
  } catch (error) {
    MessagePlugin.error(error.message || '提交记录加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  filters.page = 1;
  loadSubmissions();
}

function handlePageChange(pageInfo) {
  filters.page = pageInfo.current || 1;
  filters.pageSize = pageInfo.pageSize || filters.pageSize;
  loadSubmissions();
}

async function openDetailDialog(row) {
  detailDialogVisible.value = true;
  selectedSubmission.value = row;
  await resolveResourceURLs(getResourceFileIDs(row));

  try {
    const data = await getSubmissionDetail(row._id);
    selectedSubmission.value = data.submission || row;
    await resolveResourceURLs(getResourceFileIDs(selectedSubmission.value));
  } catch (error) {
    MessagePlugin.warning(error.message || '提交详情加载失败，已展示列表数据');
  }
}

function fillReviewForm(row = {}) {
  reviewForm.submission_id = row._id || '';
  reviewForm.status = row.status === 'approved' || row.status === 'rejected' ? row.status : 'approved';
  reviewForm.score = row.score ?? null;
  reviewForm.points_earned = Number(row.points_earned || 0);
  reviewForm.feedback = row.feedback || '';
}

function openReviewDialog(row) {
  selectedSubmission.value = row;
  fillReviewForm(row);
  reviewDialogVisible.value = true;
}

async function handleReviewSubmit() {
  const result = await reviewFormRef.value?.validate?.();
  if (result !== true && Object.keys(result || {}).length) {
    return;
  }

  saving.value = true;
  try {
    const data = await reviewSubmission({
      submission_id: reviewForm.submission_id,
      status: reviewForm.status,
      score: reviewForm.score,
      points_earned: reviewForm.status === 'approved' ? reviewForm.points_earned : 0,
      feedback: reviewForm.feedback
    });
    MessagePlugin.success('审核结果已保存');
    reviewDialogVisible.value = false;
    selectedSubmission.value = data.submission || selectedSubmission.value;
    await loadSubmissions();
  } catch (error) {
    MessagePlugin.error(error.message || '审核保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadProjects();
  loadClasses();
  loadSubmissions();
});
</script>
