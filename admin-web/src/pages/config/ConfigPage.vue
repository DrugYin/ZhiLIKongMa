<template>
  <section>
    <PageHeader
      eyebrow="System Config"
      title="系统配置"
      description="管理积分、任务、抽奖、班级等云端运营参数，配置会直接写入 system_config 集合。"
    >
      <template #actions>
        <t-popconfirm content="仅补齐缺失的默认配置，不会覆盖已有配置，确认初始化？" @confirm="handleSeedDefaults">
          <t-button variant="outline" :loading="seeding">初始化默认配置</t-button>
        </t-popconfirm>
        <t-button variant="outline" :loading="loading" @click="loadConfig">刷新</t-button>
        <t-button theme="primary" @click="openCreateDialog">新增配置</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false" class="config-card">
      <div class="config-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索配置键、分类或说明"
          class="config-search"
          @enter="loadConfig"
          @clear="loadConfig"
        />
        <t-select
          v-model="filters.category"
          clearable
          placeholder="全部分类"
          class="config-category"
          @change="loadConfig"
          @clear="loadConfig"
        >
          <t-option
            v-for="item in categoryOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </t-select>
        <t-button :loading="loading" @click="loadConfig">查询</t-button>
      </div>

      <t-table
        row-key="_id"
        :data="configRows"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        hover
      >
        <template #config_value="{ row }">
          <code class="config-value">{{ formatConfigValue(row.config_value) }}</code>
        </template>

        <template #value_type="{ row }">
          <t-tag variant="light">{{ getValueTypeLabel(row.value_type) }}</t-tag>
        </template>

        <template #category="{ row }">
          <t-tag theme="primary" variant="light">{{ row.category || 'general' }}</t-tag>
        </template>

        <template #is_enabled="{ row }">
          <t-tag :theme="row.is_enabled === false ? 'danger' : 'success'" variant="light">
            {{ row.is_enabled === false ? '停用' : '启用' }}
          </t-tag>
        </template>

        <template #update_time="{ row }">
          {{ formatDateTime(row.update_time || row.create_time) }}
        </template>

        <template #op="{ row }">
          <t-space>
            <t-button size="small" variant="text" @click="openEditDialog(row)">编辑</t-button>
            <t-popconfirm
              content="删除后小程序会回退默认值或读取不到该配置，确认删除？"
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
      :header="isEditing ? '编辑配置' : '新增配置'"
      width="620px"
      :confirm-btn="{ content: isEditing ? '保存修改' : '创建配置', loading: saving }"
      :cancel-btn="{ content: '取消' }"
      @confirm="handleSubmit"
    >
      <t-form ref="formRef" :data="form" :rules="rules" label-width="112px">
        <t-form-item label="配置键" name="config_key">
          <t-input
            v-model="form.config_key"
            :disabled="isEditing"
            placeholder="例如 points_register_gift"
          />
        </t-form-item>

        <t-form-item label="值类型" name="value_type">
          <t-select v-model="form.value_type" placeholder="请选择值类型" @change="syncValueInput">
            <t-option
              v-for="item in valueTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </t-select>
        </t-form-item>

        <t-form-item label="配置值" name="config_value">
          <t-select
            v-if="form.value_type === 'boolean'"
            v-model="form.config_value"
            placeholder="请选择布尔值"
          >
            <t-option label="true" value="true" />
            <t-option label="false" value="false" />
          </t-select>
          <t-textarea
            v-else
            v-model="form.config_value"
            :autosize="{ minRows: 3, maxRows: 8 }"
            placeholder="JSON 类型请输入合法 JSON；数字类型请输入数字"
          />
        </t-form-item>

        <t-form-item label="分类" name="category">
          <t-input v-model="form.category" placeholder="例如 points / task / lottery" />
        </t-form-item>

        <t-form-item label="说明" name="description">
          <t-textarea
            v-model="form.description"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="说明该配置影响的业务逻辑"
          />
        </t-form-item>

        <t-form-item label="排序" name="sort_order">
          <t-input-number v-model="form.sort_order" :min="0" theme="normal" />
        </t-form-item>

        <t-form-item label="状态" name="is_enabled">
          <t-switch v-model="form.is_enabled" :label="['启用', '停用']" />
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
  createConfig,
  deleteConfig,
  getConfigList,
  seedDefaultConfigs,
  updateConfig
} from '@/api/config';

const DEFAULT_FORM = {
  _id: '',
  config_key: '',
  config_value: '',
  value_type: 'string',
  category: 'general',
  description: '',
  sort_order: 100,
  is_enabled: true
};

const valueTypeOptions = [
  { label: '字符串', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔值', value: 'boolean' },
  { label: 'JSON', value: 'json' }
];

const columns = [
  { colKey: 'config_key', title: '配置键', width: 220, ellipsis: true },
  { colKey: 'config_value', title: '配置值', width: 180 },
  { colKey: 'value_type', title: '类型', width: 100 },
  { colKey: 'category', title: '分类', width: 120 },
  { colKey: 'description', title: '说明', ellipsis: true },
  { colKey: 'is_enabled', title: '状态', width: 90 },
  { colKey: 'update_time', title: '更新时间', width: 170 },
  { colKey: 'op', title: '操作', width: 150, fixed: 'right' }
];

const rules = {
  config_key: [
    { required: true, message: '请输入配置键' },
    {
      pattern: /^[a-z][a-z0-9_]{1,63}$/,
      message: '配置键需以小写字母开头，仅支持小写字母、数字和下划线'
    }
  ],
  value_type: [{ required: true, message: '请选择值类型' }],
  config_value: [{ required: true, message: '请输入配置值' }],
  category: [{ required: true, message: '请输入分类' }]
};

const loading = ref(false);
const saving = ref(false);
const seeding = ref(false);
const dialogVisible = ref(false);
const formRef = ref(null);
const configRows = ref([]);
const filters = reactive({
  keyword: '',
  category: ''
});
const form = reactive({ ...DEFAULT_FORM });

const isEditing = computed(() => Boolean(form._id));
const categoryOptions = computed(() => {
  const categories = new Set(configRows.value.map((item) => item.category || 'general'));
  return Array.from(categories).sort().map((item) => ({
    label: item,
    value: item
  }));
});
const pagination = computed(() => ({
  defaultPageSize: 10,
  showJumper: true,
  total: configRows.value.length
}));

function resetForm(row = {}) {
  Object.assign(form, {
    ...DEFAULT_FORM,
    ...row,
    config_value: stringifyFormValue(row.config_value, row.value_type),
    value_type: row.value_type || inferValueType(row.config_value),
    category: row.category || 'general',
    sort_order: Number(row.sort_order ?? DEFAULT_FORM.sort_order),
    is_enabled: row.is_enabled !== false
  });
}

function openCreateDialog() {
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(row) {
  resetForm(row);
  dialogVisible.value = true;
}

function inferValueType(value) {
  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (value && typeof value === 'object') {
    return 'json';
  }

  return 'string';
}

function stringifyFormValue(value, valueType) {
  if (value === undefined || value === null) {
    return valueType === 'boolean' ? 'false' : '';
  }

  if (valueType === 'json' || (typeof value === 'object' && valueType !== 'string')) {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function syncValueInput(valueType) {
  if (valueType === 'boolean' && !['true', 'false'].includes(form.config_value)) {
    form.config_value = 'false';
  }
}

function normalizePayload() {
  return {
    _id: form._id,
    config_key: form.config_key.trim(),
    config_value: form.config_value,
    value_type: form.value_type,
    category: form.category.trim(),
    description: form.description.trim(),
    sort_order: Number(form.sort_order || 0),
    is_enabled: Boolean(form.is_enabled)
  };
}

function formatConfigValue(value) {
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function getValueTypeLabel(value) {
  return valueTypeOptions.find((item) => item.value === value)?.label || '字符串';
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

async function loadConfig() {
  loading.value = true;
  try {
    const data = await getConfigList({
      keyword: filters.keyword.trim(),
      category: filters.category
    });
    configRows.value = data.list || [];
  } catch (error) {
    MessagePlugin.error(error.message || '系统配置加载失败');
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
    if (isEditing.value) {
      await updateConfig(normalizePayload());
      MessagePlugin.success('配置已更新');
    } else {
      await createConfig(normalizePayload());
      MessagePlugin.success('配置已创建');
    }

    dialogVisible.value = false;
    await loadConfig();
  } catch (error) {
    MessagePlugin.error(error.message || '配置保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row) {
  loading.value = true;
  try {
    await deleteConfig({
      _id: row._id,
      config_key: row.config_key
    });
    MessagePlugin.success('配置已删除');
    await loadConfig();
  } catch (error) {
    MessagePlugin.error(error.message || '配置删除失败');
  } finally {
    loading.value = false;
  }
}

async function handleSeedDefaults() {
  seeding.value = true;
  try {
    await seedDefaultConfigs();
    MessagePlugin.success('默认配置已补齐');
    await loadConfig();
  } catch (error) {
    MessagePlugin.error(error.message || '默认配置初始化失败');
  } finally {
    seeding.value = false;
  }
}

onMounted(loadConfig);
</script>
