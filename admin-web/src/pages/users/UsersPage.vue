<template>
  <section>
    <PageHeader
      eyebrow="Users"
      title="用户管理"
      description="查询学生、教师和管理员用户，维护角色、状态、积分与教师项目信息。"
    >
      <template #actions>
        <t-button variant="outline" :loading="loading" @click="loadUsers">刷新</t-button>
      </template>
    </PageHeader>

    <t-card :bordered="false" class="config-card">
      <div class="config-toolbar">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索姓名、昵称、手机号、学校或 OpenID"
          class="user-search"
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-select
          v-model="filters.role"
          clearable
          placeholder="全部角色"
          class="user-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
        </t-select>
        <t-select
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          class="user-filter"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <t-option label="正常" value="active" />
          <t-option label="用户禁用" value="disabled" />
          <t-option label="后台禁用" value="admin_disabled" />
        </t-select>
        <t-button :loading="loading" @click="handleSearch">查询</t-button>
      </div>

      <t-table
        row-key="_id"
        :data="userRows"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        hover
        @page-change="handlePageChange"
      >
        <template #user_name="{ row }">
          <div class="user-name-cell">
            <t-avatar :image="row.avatar_url || undefined" size="36px">
              {{ getAvatarText(row) }}
            </t-avatar>
            <div>
              <strong>{{ row.user_name || row.nick_name || '未命名用户' }}</strong>
              <span>{{ row.phone || row._openid || '--' }}</span>
            </div>
          </div>
        </template>

        <template #roles="{ row }">
          <t-space size="small" break-line>
            <t-tag
              v-for="role in row.roles || []"
              :key="role"
              :theme="getRoleTheme(role)"
              variant="light"
            >
              {{ getRoleLabel(role) }}
            </t-tag>
          </t-space>
        </template>

        <template #status="{ row }">
          <t-space size="small" break-line>
            <t-tag :theme="row.status === 'disabled' ? 'danger' : 'success'" variant="light">
              {{ row.status === 'disabled' ? '用户禁用' : '正常' }}
            </t-tag>
            <t-tag
              v-if="(row.roles || []).includes('admin')"
              :theme="row.admin_status === 'disabled' ? 'danger' : 'primary'"
              variant="light"
            >
              {{ row.admin_status === 'disabled' ? '后台禁用' : getAdminRoleLabel(row.admin_role) }}
            </t-tag>
          </t-space>
        </template>

        <template #points="{ row }">
          <span>{{ row.points || 0 }} / {{ row.total_points || 0 }}</span>
        </template>

        <template #teacher_project="{ row }">
          <span>{{ row.teacher_project || row.teacher_project_code || '--' }}</span>
        </template>

        <template #update_time="{ row }">
          {{ formatDateTime(row.update_time || row.create_time) }}
        </template>

        <template #op="{ row }">
          <t-button size="small" variant="text" @click="openEditDialog(row)">编辑</t-button>
        </template>
      </t-table>
    </t-card>

    <t-dialog
      v-model:visible="dialogVisible"
      header="编辑用户"
      width="760px"
      :confirm-btn="{ content: '保存修改', loading: saving }"
      :cancel-btn="{ content: '取消' }"
      @confirm="handleSubmit"
    >
      <t-form ref="formRef" :data="form" :rules="rules" label-width="112px">
        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="用户姓名" name="user_name">
              <t-input v-model="form.user_name" placeholder="请输入用户姓名" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="昵称" name="nick_name">
              <t-input v-model="form.nick_name" placeholder="可选" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="手机号" name="phone">
              <t-input v-model="form.phone" placeholder="11 位手机号，可为空" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="用户状态" name="status">
              <t-select v-model="form.status" placeholder="请选择状态">
                <t-option label="正常" value="active" />
                <t-option label="禁用" value="disabled" />
              </t-select>
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="角色" name="roles">
          <t-select
            v-model="form.roles"
            multiple
            placeholder="请选择角色"
            @change="handleRoleChange"
          >
            <t-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </t-select>
        </t-form-item>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="当前角色" name="current_role">
              <t-select v-model="form.current_role" placeholder="请选择当前角色">
                <t-option
                  v-for="role in form.roles"
                  :key="role"
                  :label="getRoleLabel(role)"
                  :value="role"
                />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="后台权限" name="admin_role">
              <t-select
                v-model="form.admin_role"
                :disabled="!form.roles.includes('admin')"
                placeholder="非管理员无需设置"
              >
                <t-option label="普通管理员" value="admin" />
                <t-option label="超级管理员" value="super_admin" />
              </t-select>
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item v-if="form.roles.includes('admin')" label="后台状态" name="admin_status">
          <t-select v-model="form.admin_status" placeholder="请选择后台状态">
            <t-option label="正常" value="active" />
            <t-option label="禁用后台登录" value="disabled" />
          </t-select>
        </t-form-item>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="当前积分" name="points">
              <t-input-number v-model="form.points" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="累计积分" name="total_points">
              <t-input-number v-model="form.total_points" :min="0" theme="normal" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="学校" name="school">
              <t-input v-model="form.school" placeholder="学校/机构" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="年级" name="grade">
              <t-input v-model="form.grade" placeholder="例如 五年级" />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="[16, 0]">
          <t-col :span="6">
            <t-form-item label="教师科目" name="teacher_subject">
              <t-input v-model="form.teacher_subject" placeholder="例如 编程" />
            </t-form-item>
          </t-col>
          <t-col :span="6">
            <t-form-item label="教师项目" name="teacher_project_code">
              <t-select
                v-model="form.teacher_project_code"
                clearable
                placeholder="请选择项目"
                @change="syncTeacherProject"
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
        </t-row>

        <t-form-item label="地址" name="address">
          <t-input v-model="form.address" placeholder="可选" />
        </t-form-item>

        <t-form-item label="OpenID">
          <code class="user-openid">{{ form._openid || '--' }}</code>
        </t-form-item>
      </t-form>
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { getProjects } from '@/api/projects';
import { getUsers, updateUser } from '@/api/users';

const DEFAULT_FORM = {
  _id: '',
  _openid: '',
  user_name: '',
  nick_name: '',
  phone: '',
  school: '',
  grade: '',
  address: '',
  roles: ['student'],
  current_role: 'student',
  status: 'active',
  points: 0,
  total_points: 0,
  teacher_subject: '',
  teacher_project: '',
  teacher_project_code: '',
  admin_role: '',
  admin_status: 'active'
};

const roleOptions = [
  { label: '学生', value: 'student' },
  { label: '教师', value: 'teacher' },
  { label: '管理员', value: 'admin' }
];

const columns = [
  { colKey: 'user_name', title: '用户', width: 220, fixed: 'left' },
  { colKey: 'roles', title: '角色', minWidth: 180 },
  { colKey: 'status', title: '状态', minWidth: 170 },
  { colKey: 'points', title: '积分/累计', width: 110, align: 'right' },
  { colKey: 'school', title: '学校', minWidth: 150, ellipsis: true },
  { colKey: 'teacher_project', title: '教师项目', width: 120 },
  { colKey: 'update_time', title: '更新时间', width: 170 },
  { colKey: 'op', title: '操作', width: 90, fixed: 'right' }
];

const rules = {
  user_name: [
    { required: true, message: '请输入用户姓名' },
    { max: 20, message: '用户姓名不能超过 20 个字符' }
  ],
  status: [{ required: true, message: '请选择用户状态' }],
  roles: [{ required: true, message: '请选择至少一个角色' }],
  current_role: [{ required: true, message: '请选择当前角色' }]
};

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const formRef = ref(null);
const userRows = ref([]);
const projectOptions = ref([]);
const total = ref(0);
const filters = reactive({
  keyword: '',
  role: '',
  status: '',
  page: 1,
  pageSize: 20
});
const form = reactive(createDefaultForm());

const pagination = computed(() => ({
  current: filters.page,
  pageSize: filters.pageSize,
  total: total.value,
  showJumper: true,
  pageSizeOptions: [10, 20, 50, 100]
}));

function createDefaultForm() {
  return {
    ...DEFAULT_FORM,
    roles: [...DEFAULT_FORM.roles]
  };
}

function resetForm(row = {}) {
  const roles = Array.isArray(row.roles) && row.roles.length ? [...row.roles] : ['student'];
  Object.assign(form, {
    ...createDefaultForm(),
    ...row,
    roles,
    current_role: roles.includes(row.current_role) ? row.current_role : roles[0],
    status: row.status || 'active',
    points: Number(row.points || 0),
    total_points: Number(row.total_points || 0),
    admin_role: row.admin_role || (roles.includes('admin') ? 'admin' : ''),
    admin_status: row.admin_status || 'active'
  });
}

function getRoleLabel(role) {
  return roleOptions.find((item) => item.value === role)?.label || role;
}

function getRoleTheme(role) {
  const themeMap = {
    student: 'success',
    teacher: 'warning',
    admin: 'primary'
  };
  return themeMap[role] || 'default';
}

function getAdminRoleLabel(role) {
  return role === 'super_admin' ? '超级管理员' : '管理员';
}

function getAvatarText(row) {
  return String(row.user_name || row.nick_name || '用').slice(0, 1);
}

function handleRoleChange(value = []) {
  if (!value.length) {
    form.roles = ['student'];
    form.current_role = 'student';
    form.admin_role = '';
    form.admin_status = 'active';
    return;
  }

  if (!value.includes(form.current_role)) {
    form.current_role = value[0];
  }

  if (value.includes('admin')) {
    form.admin_role = form.admin_role || 'admin';
  } else {
    form.admin_role = '';
    form.admin_status = 'active';
  }
}

function syncTeacherProject(projectCode) {
  const project = projectOptions.value.find((item) => item.project_code === projectCode);
  form.teacher_project = project?.project_name || '';
}

function normalizePayload() {
  return {
    _id: form._id,
    user_name: form.user_name.trim(),
    nick_name: form.nick_name.trim(),
    phone: form.phone.trim(),
    school: form.school.trim(),
    grade: form.grade.trim(),
    address: form.address.trim(),
    roles: form.roles,
    current_role: form.current_role,
    status: form.status,
    points: Number(form.points || 0),
    total_points: Number(form.total_points || 0),
    teacher_subject: form.teacher_subject.trim(),
    teacher_project: form.teacher_project.trim(),
    teacher_project_code: form.teacher_project_code,
    admin_role: form.admin_role,
    admin_status: form.admin_status
  };
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
    const data = await getProjects({
      status: 'active'
    });
    projectOptions.value = data.list || [];
  } catch (error) {
    MessagePlugin.warning(error.message || '项目列表加载失败，教师项目只能手动维护');
  }
}

async function loadUsers() {
  loading.value = true;
  try {
    const data = await getUsers({
      keyword: filters.keyword.trim(),
      role: filters.role,
      status: filters.status,
      page: filters.page,
      page_size: filters.pageSize
    });
    userRows.value = data.list || [];
    total.value = data.total || 0;
  } catch (error) {
    MessagePlugin.error(error.message || '用户列表加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  filters.page = 1;
  loadUsers();
}

function handlePageChange(pageInfo) {
  filters.page = pageInfo.current || 1;
  filters.pageSize = pageInfo.pageSize || filters.pageSize;
  loadUsers();
}

function openEditDialog(row) {
  resetForm(row);
  dialogVisible.value = true;
}

async function handleSubmit() {
  const validResult = await formRef.value?.validate();
  if (validResult !== true) {
    return;
  }

  saving.value = true;
  try {
    await updateUser(normalizePayload());
    MessagePlugin.success('用户已更新');
    dialogVisible.value = false;
    await loadUsers();
  } catch (error) {
    MessagePlugin.error(error.message || '用户保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadProjects();
  loadUsers();
});
</script>
