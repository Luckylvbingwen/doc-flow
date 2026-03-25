<template>
  <el-drawer
    v-model="visible"
    :title="title"
    :size="size"
    :direction="direction"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :destroy-on-close="destroyOnClose"
    :append-to-body="appendToBody"
    class="df-detail-drawer"
    @close="onClose"
  >
    <template #header>
      <div class="df-drawer-header">
        <span class="df-drawer-title">{{ title }}</span>
        <slot name="header-extra" />
      </div>
    </template>

    <div class="df-drawer-body">
      <slot />
    </div>

    <template v-if="$slots.footer" #footer>
      <div class="df-drawer-footer">
        <slot name="footer" />
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '详情' },
  size: { type: [String, Number], default: '560px' },
  direction: { type: String, default: 'rtl' },
  closeOnClickModal: { type: Boolean, default: true },
  closeOnPressEscape: { type: Boolean, default: true },
  destroyOnClose: { type: Boolean, default: false },
  appendToBody: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'close'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const onClose = () => {
  emit('close')
}
</script>

<style scoped>
.df-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.df-drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--df-text);
}

.df-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 4px;
}

.df-drawer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
</style>

<style>
/* ── df-detail-drawer 全局层叠覆盖 ── */
.df-detail-drawer {
  box-shadow: -12px 0 40px rgba(0, 0, 0, 0.1);
}

.df-detail-drawer .el-drawer__header {
  margin-bottom: 0;
  padding: 20px 24px;
  border-bottom: 1px solid var(--df-border);
}

.df-detail-drawer .el-drawer__body {
  padding: 24px;
  overflow: auto;
}

.df-detail-drawer .el-drawer__footer {
  padding: 16px 24px;
  border-top: 1px solid var(--df-border);
  background: var(--df-surface);
}

html.dark .df-detail-drawer {
  box-shadow: -12px 0 40px rgba(0, 0, 0, 0.3);
}
</style>
