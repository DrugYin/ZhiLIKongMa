<template>
  <section>
    <PageHeader
      eyebrow="Operation Logs"
      title="操作日志"
      description="追踪配置、项目、用户角色等后台管理操作，支撑审计和问题回溯。"
    />
    <t-card :bordered="false" class="placeholder-card">
      <t-empty title="操作日志待接入" description="下一步实现 admin-get-operation-logs 云函数。" />
    </t-card>
  </section>
</template>

<script setup>
import PageHeader from '@/components/PageHeader.vue';
</script>
