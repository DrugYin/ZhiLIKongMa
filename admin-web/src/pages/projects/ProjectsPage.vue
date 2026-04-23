<template>
  <section>
    <PageHeader
      eyebrow="Projects"
      title="项目配置"
      description="维护编程、无人机、机器人等训练项目，项目会写入 projects 集合供小程序任务和班级模块读取。"
    >
      <template #actions>
        <t-popconfirm content="仅补齐缺失的默认项目，不会覆盖已有项目，确认初始化？" @confirm="handleSeedDefaults">
          <t-button variant="outline" :loading="seeding">初始化默认项目</t-button>
        </t-popconfirm>
        <t-button variant="outline" :loading="loading" @click="loadProjects">刷新</t-button>
        <t-button theme="primary" @click="openCreateDialog">新增项目</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false" class="config-card">
      <div class="config-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索项目名称、编码或说明"
          class="config-search"
          @enter="loadProjects"
          @clear="loadProjects"
        />
        <t-select
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          class="project-status-filter"
          @change="loadProjects"
          @clear="loadProjects"
        >
          <t-option label="启用" value="active" />
          <t-option label="停用" value="inactive" />
        </t-select>
        <t-button :loading="loading" @click="loadProjects">查询</t-button>
      </div>

      <t-table
        row-key="_id"
        :data="projectRows"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        hover
      >
        <template #project_name="{ row }">
          <div class="project-name-cell">
            <strong>{{ row.project_name }}</strong>
            <span>{{ row.project_code }}</span>
          </div>
        </template>

        <template #status="{ row }">
          <t-tag :theme="row.status === 'active' ? 'success' : 'danger'" variant="light">
            {{ row.status === 'active' ? '启用' : '停用' }}
          </t-tag>
        </template>

        <template #task_categories="{ row }">
          <t-space size="small" break-line>
            <t-tag v-for="item in row.task_categories || []" :key="item" variant="light">{{ item }}</t-tag>
          </t-space>
        </template>

        <template #difficulty_levels="{ row }">
          <span>{{ (row.difficulty_levels || []).length }} 个等级</span>
        </template>

        <template #usage="{ row }">
          <span>任务 {{ row.task_count || 0 }} / 班级 {{ row.class_count || 0 }}</span>
        </template>

        <template #update_time="{ row }">
          {{ formatDateTime(row.update_time || row.create_time) }}
        </template>

        <template #op="{ row }">
          <t-space>
            <t-button size="small" variant="text" @click="openEditDialog(row)">编辑</t-button>
            <t-popconfirm
              content="删除会影响项目下拉。若已有任务或班级引用，云函数会阻止删除，确认继续？"
              @confirm="handleDelete(row)"
            >
              <t-button size="small" theme="danger" variant="text">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog
      v-model:visible="dialogVisible"
      :header="isEditing ? '编辑项目' : '新增项目'"
      width="760px"
      :confirm-btn="{ content: isEditing ? '保存修改' : '创建项目', loading: saving }"
      :cancel-btn="{ content: '取消' }"
      @confirm="handleSubmit"
    >
      <t-form ref="formRef" :data="form" :rules="rules" label-width="116px">
        <t-form-item label="项目名称" name="project_name">
          <t-input v-model="form.project_name" placeholder="例如 编程" />
        </t-form-item>

        <t-form-item label="项目编码" name="project_code">
          <t-input
            v-model="form.project_code"
            :disabled="isEditing"
            placeholder="例如 programming"
          />
        </t-form-item>

        <t-form-item label="说明" name="description">
          <t-textarea
            v-model="form.description"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="用于小程序项目选择、任务发布和班级项目展示"
          />
        </t-form-item>

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
            <t-form-item label="排序" name="sort_order">
              <t-input-number v-model="form.sort_order" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="默认积分" name="default_points">
              <t-input-number v-model="form.default_points" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="奖励倍率" name="bonus_multiplier">
              <t-input-number v-model="form.bonus_multiplier" :min="0" :step="0.1" theme="normal" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="图标" name="icon">
          <t-input v-model="form.icon" placeholder="可填写图标名或资源地址，当前可为空" />
        </t-form-item>

        <t-form-item label="封面图" name="cover_image">
          <t-input v-model="form.cover_image" placeholder="可填写 cloud:// 或 https:// 图片地址，当前可为空" />
        </t-form-item>

        <t-form-item label="任务分类" name="task_categories">
          <div class="project-editor-list">
            <div
              v-for="(item, index) in form.task_categories"
              :key="`category-${index}`"
              class="project-editor-row"
            >
              <t-input
                v-model="form.task_categories[index]"
                placeholder="例如 基础语法、算法练习、项目实战"
              />
              <t-button theme="danger" variant="text" @click="removeCategory(index)">删除</t-button>
            </div>
            <t-button variant="outline" block @click="addCategory">新增分类</t-button>
          </div>
        </t-form-item>

        <t-form-item label="难度等级" name="difficulty_levels">
          <div class="project-editor-list">
            <div
              v-for="(item, index) in form.difficulty_levels"
              :key="`difficulty-${index}`"
              class="project-difficulty-row"
            >
              <t-input-number
                v-model="item.level"
                :min="1"
                theme="normal"
                class="project-level-input"
              />
              <t-input v-model="item.name" placeholder="名称，例如 入门" />
              <div class="project-color-field">
                <input v-model="item.color" class="project-color-picker" type="color" />
                <t-input v-model="item.color" placeholder="#1890ff" />
              </div>
              <t-button theme="danger" variant="text" @click="removeDifficultyLevel(index)">
                删除
              </t-button>
            </div>
            <t-button variant="outline" block @click="addDifficultyLevel">新增难度等级</t-button>
          </div>
        </t-form-item>
      </t-form>
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import {
  createProject,
  deleteProject,
  getProjects,
  seedDefaultProjects,
  updateProject
} from '@/api/projects';

const DEFAULT_DIFFICULTY_LEVELS = [
  { level: 1, name: '入门', color: '#52c41a' },
  { level: 2, name: '基础', color: '#1890ff' },
  { level: 3, name: '进阶', color: '#faad14' },
  { level: 4, name: '高级', color: '#ff4d4f' },
  { level: 5, name: '专家', color: '#722ed1' }
];
const DEFAULT_TASK_CATEGORIES = ['基础训练'];
const DEFAULT_FORM = {
  _id: '',
  project_name: '',
  project_code: '',
  description: '',
  cover_image: '',
  icon: '',
  task_categories: DEFAULT_TASK_CATEGORIES,
  difficulty_levels: DEFAULT_DIFFICULTY_LEVELS,
  default_points: 10,
  bonus_multiplier: 1,
  sort_order: 100,
  status: 'active'
};

function createDefaultForm() {
  return {
    ...DEFAULT_FORM,
    task_categories: [...DEFAULT_TASK_CATEGORIES],
    difficulty_levels: cloneDifficultyLevels(DEFAULT_DIFFICULTY_LEVELS)
  };
}

const columns = [
  { colKey: 'project_name', title: '项目', width: 180, fixed: 'left' },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'task_categories', title: '任务分类', minWidth: 220 },
  { colKey: 'difficulty_levels', title: '难度', width: 100 },
  { colKey: 'default_points', title: '默认积分', width: 100, align: 'right' },
  { colKey: 'bonus_multiplier', title: '倍率', width: 90, align: 'right' },
  { colKey: 'usage', title: '引用', width: 150 },
  { colKey: 'sort_order', title: '排序', width: 80, align: 'right' },
  { colKey: 'update_time', title: '更新时间', width: 170 },
  { colKey: 'op', title: '操作', width: 150, fixed: 'right' }
];

const rules = {
  project_name: [{ required: true, message: '请输入项目名称' }],
  project_code: [
    { required: true, message: '请输入项目编码' },
    {
      pattern: /^[a-z][a-z0-9_]{1,63}$/,
      message: '项目编码需以小写字母开头，仅支持小写字母、数字和下划线'
    }
  ],
  status: [{ required: true, message: '请选择状态' }]
};

const loading = ref(false);
const saving = ref(false);
const seeding = ref(false);
const dialogVisible = ref(false);
const formRef = ref(null);
const projectRows = ref([]);
const filters = reactive({
  keyword: '',
  status: ''
});
const form = reactive(createDefaultForm());

const isEditing = computed(() => Boolean(form._id));
const pagination = computed(() => ({
  defaultPageSize: 10,
  showJumper: true,
  total: projectRows.value.length
}));

function resetForm(row = {}) {
  Object.assign(form, {
    ...createDefaultForm(),
    ...row,
    task_categories: cloneCategories(row.task_categories),
    difficulty_levels: cloneDifficultyLevels(row.difficulty_levels),
    default_points: Number(row.default_points ?? DEFAULT_FORM.default_points),
    bonus_multiplier: Number(row.bonus_multiplier ?? DEFAULT_FORM.bonus_multiplier),
    sort_order: Number(row.sort_order ?? DEFAULT_FORM.sort_order),
    status: row.status || 'active'
  });
}

function cloneCategories(categories) {
  if (!Array.isArray(categories) || !categories.length) {
    return [...DEFAULT_TASK_CATEGORIES];
  }

  const normalized = categories.map((item) => String(item || '').trim()).filter(Boolean);
  return normalized.length ? normalized : [...DEFAULT_TASK_CATEGORIES];
}

function cloneDifficultyLevels(levels) {
  const source = Array.isArray(levels) && levels.length ? levels : DEFAULT_DIFFICULTY_LEVELS;
  return source.map((item) => ({
    level: Number(item.level) || 1,
    name: String(item.name || '').trim(),
    color: String(item.color || '#1890ff').trim()
  }));
}

function addCategory() {
  form.task_categories.push('');
}

function removeCategory(index) {
  if (form.task_categories.length <= 1) {
    form.task_categories[0] = '';
    return;
  }

  form.task_categories.splice(index, 1);
}

function addDifficultyLevel() {
  const maxLevel = Math.max(0, ...form.difficulty_levels.map((item) => Number(item.level) || 0));
  form.difficulty_levels.push({
    level: maxLevel + 1,
    name: '',
    color: '#1890ff'
  });
}

function removeDifficultyLevel(index) {
  if (form.difficulty_levels.length <= 1) {
    MessagePlugin.warning('难度等级至少保留一项');
    return;
  }

  form.difficulty_levels.splice(index, 1);
}

function normalizeCategories() {
  const categories = form.task_categories.map((item) => String(item || '').trim()).filter(Boolean);
  if (!categories.length) {
    throw new Error('任务分类至少需要一项');
  }

  return [...new Set(categories)];
}

function normalizeDifficultyLevels() {
  if (!Array.isArray(form.difficulty_levels) || !form.difficulty_levels.length) {
    throw new Error('难度等级至少需要一项');
  }

  const levels = form.difficulty_levels.map((item) => ({
    level: Number(item.level),
    name: String(item.name || '').trim(),
    color: String(item.color || '#1890ff').trim()
  }));

  const levelSet = new Set();
  levels.forEach((item) => {
    if (!Number.isInteger(item.level) || item.level <= 0 || !item.name) {
      throw new Error('难度等级每项都必须包含正整数 level 和 name');
    }

    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(item.color)) {
      throw new Error(`难度等级 ${item.level} 的颜色必须是十六进制色值`);
    }

    if (levelSet.has(item.level)) {
      throw new Error(`难度等级 ${item.level} 重复`);
    }

    levelSet.add(item.level);
  });

  return levels.sort((current, next) => current.level - next.level);
}

function normalizePayload() {
  return {
    _id: form._id,
    project_name: form.project_name.trim(),
    project_code: form.project_code.trim(),
    description: form.description.trim(),
    cover_image: form.cover_image.trim(),
    icon: form.icon.trim(),
    task_categories: normalizeCategories(),
    difficulty_levels: normalizeDifficultyLevels(),
    default_points: Number(form.default_points || 0),
    bonus_multiplier: Number(form.bonus_multiplier || 0),
    sort_order: Number(form.sort_order || 0),
    status: form.status
  };
}

function openCreateDialog() {
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(row) {
  resetForm(row);
  dialogVisible.value = true;
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
  loading.value = true;
  try {
    const data = await getProjects({
      keyword: filters.keyword.trim(),
      status: filters.status
    });
    projectRows.value = data.list || [];
  } catch (error) {
    MessagePlugin.error(error.message || '项目配置加载失败');
  } finally {
    loading.value = false;
  }
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
      await updateProject(payload);
      MessagePlugin.success('项目已更新');
    } else {
      await createProject(payload);
      MessagePlugin.success('项目已创建');
    }

    dialogVisible.value = false;
    await loadProjects();
  } catch (error) {
    MessagePlugin.error(error.message || '项目保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row) {
  loading.value = true;
  try {
    await deleteProject({
      _id: row._id,
      project_code: row.project_code
    });
    MessagePlugin.success('项目已删除');
    await loadProjects();
  } catch (error) {
    MessagePlugin.error(error.message || '项目删除失败');
  } finally {
    loading.value = false;
  }
}

async function handleSeedDefaults() {
  seeding.value = true;
  try {
    await seedDefaultProjects();
    MessagePlugin.success('默认项目已补齐');
    await loadProjects();
  } catch (error) {
    MessagePlugin.error(error.message || '默认项目初始化失败');
  } finally {
    seeding.value = false;
  }
}

onMounted(loadProjects);
</script>
