<template>
  <section>
    <PageHeader
      eyebrow="Lottery"
      title="奖品管理"
      description="管理抽奖奖品信息，支持增删改查、上架/下架操作，配置会直接写入 prizes 集合。"
    >
      <template #actions>
        <t-popconfirm content="仅补齐缺失的默认奖品，不会覆盖已有奖品，确认初始化？" @confirm="handleSeedDefaults">
          <t-button variant="outline" :loading="seeding">初始化默认奖品</t-button>
        </t-popconfirm>
        <t-button variant="outline" :loading="loading" @click="loadPrizes">刷新</t-button>
        <t-button theme="primary" @click="openCreateDialog">新增奖品</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false" class="prizes-card">
      <div class="prizes-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索奖品名称或描述"
          class="prizes-search"
          @enter="loadPrizes"
          @clear="loadPrizes"
        />
        <t-select
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          class="prizes-status"
          @change="loadPrizes"
          @clear="loadPrizes"
        >
          <t-option label="上架" value="active" />
          <t-option label="下架" value="disabled" />
        </t-select>
        <t-button :loading="loading" @click="loadPrizes">查询</t-button>
      </div>

      <t-table
        row-key="_id"
        :data="prizeRows"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        hover
      >
        <template #image="{ row }">
          <t-image
            v-if="row.image"
            :src="row.image"
            fit="cover"
            class="prize-thumb"
          />
          <span v-else class="prize-no-image">--</span>
        </template>

        <template #type="{ row }">
          <t-tag variant="light">{{ getTypeLabel(row.type) }}</t-tag>
        </template>

        <template #probability="{ row }">
          <span>{{ formatPercent(row.probability) }}</span>
        </template>

        <template #status="{ row }">
          <t-tag :theme="row.status === 'active' ? 'success' : 'danger'" variant="light">
            {{ row.status === 'active' ? '上架' : '下架' }}
          </t-tag>
        </template>

        <template #update_time="{ row }">
          {{ formatDateTime(row.update_time || row.create_time) }}
        </template>

        <template #op="{ row }">
          <t-space>
            <t-button size="small" variant="text" @click="openEditDialog(row)">编辑</t-button>
            <t-button
              size="small"
              variant="text"
              :theme="row.status === 'active' ? 'warning' : 'success'"
              @click="handleToggle(row)"
            >
              {{ row.status === 'active' ? '下架' : '上架' }}
            </t-button>
            <t-popconfirm
              content="删除后学生端将不可见此奖品，确认删除？"
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
      :header="isEditing ? '编辑奖品' : '新增奖品'"
      width="620px"
      :confirm-btn="{ content: isEditing ? '保存修改' : '创建奖品', loading: saving }"
      :cancel-btn="{ content: '取消' }"
      @confirm="handleSubmit"
    >
      <t-form ref="formRef" :data="form" :rules="rules" label-width="96px">
        <t-form-item label="奖品名称" name="name">
          <t-input v-model="form.name" placeholder="例如：精美笔记本" />
        </t-form-item>

        <t-form-item label="奖品类型" name="type">
          <t-select v-model="form.type" placeholder="请选择奖品类型">
            <t-option
              v-for="item in typeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </t-select>
        </t-form-item>

        <t-form-item label="描述" name="description">
          <t-textarea
            v-model="form.description"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="奖品描述信息"
          />
        </t-form-item>

        <t-form-item label="图片" name="image">
          <t-input v-model="form.image" placeholder="云存储 fileID，例如 cloud://xxx" />
        </t-form-item>

        <t-row :gutter="16">
          <t-col :span="6">
            <t-form-item label="库存" name="stock">
              <t-input-number v-model="form.stock" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="价值(积分)" name="value">
              <t-input-number v-model="form.value" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="中奖概率" name="probability">
          <t-input-number
            v-model="form.probability"
            :min="0"
            :max="1"
            :step="0.01"
            :decimalPlaces="2"
            theme="normal"
          />
          <span class="form-tip">取值范围 0-1，例如 0.30 表示 30%</span>
        </t-form-item>

        <t-form-item label="排序" name="sort_order">
          <t-input-number v-model="form.sort_order" :min="0" theme="normal" />
        </t-form-item>

        <t-form-item label="状态" name="status">
          <t-switch
            v-model="form.status"
            :custom-value="['active', 'disabled']"
            :label="['上架', '下架']"
          />
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
  createPrize,
  deletePrize,
  getPrizeList,
  seedDefaultPrizes,
  togglePrizeStatus,
  updatePrize
} from '@/api/prizes';

const DEFAULT_FORM = {
  _id: '',
  name: '',
  description: '',
  image: '',
  type: 'physical',
  stock: 100,
  probability: 0.1,
  value: 50,
  status: 'active',
  sort_order: 0
};

const typeOptions = [
  { label: '实物', value: 'physical' },
  { label: '虚拟', value: 'virtual' },
  { label: '积分', value: 'points' }
];

const columns = [
  { colKey: 'name', title: '奖品名称', width: 160, ellipsis: true },
  { colKey: 'image', title: '图片', width: 80 },
  { colKey: 'type', title: '类型', width: 80 },
  { colKey: 'stock', title: '库存', width: 80 },
  { colKey: 'value', title: '价值', width: 80 },
  { colKey: 'probability', title: '中奖概率', width: 100 },
  { colKey: 'status', title: '状态', width: 80 },
  { colKey: 'description', title: '描述', ellipsis: true },
  { colKey: 'update_time', title: '更新时间', width: 170 },
  { colKey: 'op', title: '操作', width: 210, fixed: 'right' }
];

const rules = {
  name: [{ required: true, message: '请输入奖品名称' }],
  type: [{ required: true, message: '请选择奖品类型' }],
  stock: [
    { required: true, message: '请输入库存' },
    { validator: (val) => val >= 0, message: '库存不能为负数' }
  ],
  probability: [
    { required: true, message: '请输入中奖概率' },
    { validator: (val) => val >= 0 && val <= 1, message: '概率必须在 0-1 之间' }
  ]
};

const loading = ref(false);
const saving = ref(false);
const seeding = ref(false);
const dialogVisible = ref(false);
const formRef = ref(null);
const prizeRows = ref([]);
const filters = reactive({
  keyword: '',
  status: ''
});
const form = reactive({ ...DEFAULT_FORM });

const isEditing = computed(() => Boolean(form._id));
const pagination = computed(() => ({
  defaultPageSize: 10,
  showJumper: true,
  total: prizeRows.value.length
}));

function resetForm(row = {}) {
  Object.assign(form, {
    ...DEFAULT_FORM,
    ...row,
    stock: Number(row.stock ?? DEFAULT_FORM.stock),
    probability: Number(row.probability ?? DEFAULT_FORM.probability),
    value: Number(row.value ?? DEFAULT_FORM.value),
    sort_order: Number(row.sort_order ?? DEFAULT_FORM.sort_order),
    status: row.status || 'active'
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

function getTypeLabel(type) {
  return typeOptions.find((item) => item.value === type)?.label || type || '--';
}

function formatPercent(value) {
  if (value === undefined || value === null) return '--';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function normalizePayload() {
  return {
    _id: form._id,
    name: form.name.trim(),
    description: form.description.trim(),
    image: form.image.trim(),
    type: form.type,
    stock: Number(form.stock || 0),
    probability: Number(form.probability || 0),
    value: Number(form.value || 0),
    status: form.status,
    sort_order: Number(form.sort_order || 0)
  };
}

async function loadPrizes() {
  loading.value = true;
  try {
    const data = await getPrizeList({
      keyword: filters.keyword.trim(),
      status: filters.status
    });
    prizeRows.value = data.list || [];
  } catch (error) {
    MessagePlugin.error(error.message || '奖品列表加载失败');
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  saving.value = true;

  const validResult = await formRef.value?.validate();
  if (validResult !== true) {
    saving.value = false;
    return;
  }

  try {
    if (isEditing.value) {
      await updatePrize(normalizePayload());
      MessagePlugin.success('奖品已更新');
    } else {
      await createPrize(normalizePayload());
      MessagePlugin.success('奖品已创建');
    }
    dialogVisible.value = false;
    await loadPrizes();
  } catch (error) {
    MessagePlugin.error(error.message || '奖品保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleToggle(row) {
  loading.value = true;
  try {
    await togglePrizeStatus(row._id);
    MessagePlugin.success(row.status === 'active' ? '已下架' : '已上架');
    await loadPrizes();
  } catch (error) {
    MessagePlugin.error(error.message || '状态切换失败');
  } finally {
    loading.value = false;
  }
}

async function handleDelete(row) {
  loading.value = true;
  try {
    await deletePrize(row._id);
    MessagePlugin.success('奖品已删除');
    await loadPrizes();
  } catch (error) {
    MessagePlugin.error(error.message || '奖品删除失败');
  } finally {
    loading.value = false;
  }
}

async function handleSeedDefaults() {
  seeding.value = true;
  try {
    await seedDefaultPrizes();
    MessagePlugin.success('默认奖品已补齐');
    await loadPrizes();
  } catch (error) {
    MessagePlugin.error(error.message || '默认奖品初始化失败');
  } finally {
    seeding.value = false;
  }
}

onMounted(loadPrizes);
</script>

<style scoped>
.prizes-card {
  margin-top: 16px;
}

.prizes-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.prizes-search {
  width: 240px;
}

.prizes-status {
  width: 140px;
}

.prize-thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
}

.prize-no-image {
  color: #999;
  font-size: 13px;
}

.form-tip {
  margin-left: 8px;
  color: #999;
  font-size: 12px;
}
</style>
