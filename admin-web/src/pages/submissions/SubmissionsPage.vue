<template>
  <section>
    <PageHeader
      eyebrow="Submissions"
      title="提交记录"
      description="查看学生提交与审核状态，辅助定位待审核积压和异常记录。"
    />
    <t-card :bordered="false" class="placeholder-card">
      <t-empty title="提交记录待接入" description="下一步实现 admin-get-submissions 云函数和分页列表。" />
    </t-card>
  </section>
</template>

<script setup>
import PageHeader from '@/components/PageHeader.vue';
</script>
