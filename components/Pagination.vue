<template>
  <div class="df-pagination">
    <div class="df-pagination-left">
      <span class="df-pagination-summary">
        <slot name="left">{{ defaultSummary }}</slot>
      </span>
      <span class="df-pagination-size-label">每页</span>
      <el-select v-model="currentPageSize" size="small" class="df-pagination-size-select">
        <el-option v-for="size in pageSizes" :key="size" :label="String(size)" :value="size" />
      </el-select>
      <span class="df-pagination-size-unit">条</span>
    </div>
    <el-pagination
      v-model:current-page="currentPage"
      :page-size="pageSize"
      :total="total"
      :pager-count="pagerCount"
      :disabled="disabled"
      :small="small"
      layout="prev, pager, next"
      @current-change="onPageChange"
    />
  </div>
</template>

<script setup>
const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  total: { type: Number, default: 0 },
  pageSizes: { type: Array, default: () => [10, 20, 50, 100] },
  pagerCount: { type: Number, default: 5 },
  disabled: { type: Boolean, default: false },
  small: { type: Boolean, default: false }
})

const emit = defineEmits(['update:page', 'update:pageSize', 'change'])

const currentPage = computed({
  get: () => props.page,
  set: (val) => emit('update:page', val)
})

const currentPageSize = computed({
  get: () => props.pageSize,
  set: (val) => {
    emit('update:pageSize', val)
    emit('update:page', 1)
    emit('change', { page: 1, pageSize: val })
  }
})

const defaultSummary = computed(() => {
  if (!props.total) return '共 0 条'
  const start = (props.page - 1) * props.pageSize + 1
  const end = Math.min(props.page * props.pageSize, props.total)
  return `共 ${props.total} 条，第 ${start}-${end} 条`
})

const onPageChange = (page) => {
  emit('change', { page, pageSize: props.pageSize })
}
</script>

<style scoped>
.df-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: var(--df-panel);
  border: 1px solid var(--df-border);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.df-pagination-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--df-subtext);
  flex-wrap: wrap;
}

.df-pagination-summary {
  color: var(--df-text);
}

.df-pagination-size-label,
.df-pagination-size-unit {
  color: var(--df-subtext);
}

.df-pagination-size-select {
  width: 72px;
}

.df-pagination :deep(.df-pagination-size-select .el-input__wrapper) {
  border-radius: 8px;
}

.df-pagination :deep(.el-pager li),
.df-pagination :deep(.btn-prev),
.df-pagination :deep(.btn-next) {
  min-width: 32px;
  height: 32px;
  line-height: 32px;
  border: 1px solid var(--df-border);
  border-radius: 8px;
  background: var(--df-panel);
  color: var(--df-subtext);
  font-weight: 500;
  margin: 0 2px;
}

.df-pagination :deep(.el-pager li.is-active) {
  background: var(--df-primary);
  border-color: var(--df-primary);
  color: #fff;
}

.df-pagination :deep(.btn-prev:disabled),
.df-pagination :deep(.btn-next:disabled) {
  opacity: 0.45;
}
</style>
