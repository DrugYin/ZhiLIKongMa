<template>
  <t-card class="stat-card" :bordered="false">
    <p class="stat-label">{{ label }}</p>
    <div class="stat-value">{{ value }}</div>
    <p class="stat-desc">{{ description }}</p>
  </t-card>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    default: '--'
  },
  description: {
    type: String,
    default: ''
  }
});
</script>
