<template>
  <section>
    <PageHeader
      eyebrow="Users"
      title="用户管理"
      description="查询学生、教师和管理员用户，后续支持角色调整与状态管理。"
    />
    <t-card :bordered="false" class="placeholder-card">
      <t-empty title="用户管理待接入" description="下一步实现 admin-get-users 云函数和分页筛选表格。" />
    </t-card>
  </section>
</template>

<script setup>
import PageHeader from '@/components/PageHeader.vue';
</script>
