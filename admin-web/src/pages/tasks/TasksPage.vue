<template>
  <section>
    <PageHeader
      eyebrow="Tasks"
      title="任务管理"
      description="后台只做任务查询和运营排查，第一阶段不替代教师端发布与审核流程。"
    />
    <t-card :bordered="false" class="placeholder-card">
      <t-empty title="任务查询待接入" description="下一步实现 admin-get-tasks 云函数和项目/班级/状态筛选。" />
    </t-card>
  </section>
</template>

<script setup>
import PageHeader from '@/components/PageHeader.vue';
</script>
