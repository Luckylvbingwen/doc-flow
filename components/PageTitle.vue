<template>
  <div class="page-title">
    <div class="page-title-text">
      <div class="page-title-main">
        <h2>{{ title }}</h2>
        <slot name="after-title" />
      </div>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-title-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})
</script>

<style scoped>
.page-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.page-title-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-title-text h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--df-text);
  margin: 0;
}

.page-title-text p {
  font-size: 13px;
  color: var(--df-subtext);
  margin: 4px 0 0;
}

.page-title-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
