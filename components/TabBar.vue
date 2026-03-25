<template>
  <div class="df-tab-bar">
    <div class="df-tab-bar-left">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="df-tab-item"
        :class="{ active: modelValue === tab.value }"
        @click="emit('update:modelValue', tab.value)"
      >
        <span class="df-tab-name">{{ tab.label }}</span>
        <span v-if="tab.count !== undefined" class="df-tab-count">({{ tab.count }})</span>
      </button>
    </div>
    <div v-if="$slots.right" class="df-tab-bar-right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  tabs: { type: Array, required: true },
  modelValue: { type: [String, Number], required: true }
})

const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.df-tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 16px;
  background: var(--df-panel);
  border: 1px solid var(--df-border);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.df-tab-bar-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.df-tab-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: var(--df-surface);
  color: var(--df-subtext);
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  line-height: 1.4;
}

.df-tab-item:hover {
  color: var(--df-primary);
  background: var(--df-primary-soft);
}

.df-tab-item.active {
  background: var(--df-primary);
  color: #ffffff;
}

.df-tab-count {
  font-variant-numeric: tabular-nums;
}

.df-tab-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: fit-content;
}
</style>
