<template>
  <Modal v-model="visibleLocal" title="转移归属人" width="560px">
    <template #footer>
      <el-button @click="visibleLocal = false">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!selectedUser" @click="handleConfirm">
        发送转移请求
      </el-button>
    </template>

    <div class="otm-body">
      <div class="otm-row">
        <div class="otm-label">文档</div>
        <div class="otm-value">{{ documentTitle }}</div>
      </div>
      <div class="otm-row">
        <div class="otm-label">新归属人</div>
        <div class="otm-picker">
          <el-input :model-value="selectedUser ? selectedUser.name : ''" readonly placeholder="请选择新归属人" />
          <el-button @click="selectorVisible = true">选择成员</el-button>
        </div>
      </div>
      <div class="otm-tip">
        发送后需对方同意才会生效；待响应期间不允许再次发起转移或删除文档。
      </div>
    </div>
  </Modal>

  <MemberSelectorModal
:visible="selectorVisible" :multiple="false" :show-role-selector="false"
    :exclude-user-ids="[excludeUserId]" @update:visible="selectorVisible = $event" @confirm="onSelectUser" />
</template>

<script setup lang="ts">
import type { SelectedUser } from '~/types/group-member'
import { apiInitiateDocumentTransfer } from '~/api/documents'

const props = defineProps<{
  modelValue: boolean
  documentId: number
  documentTitle: string
  excludeUserId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
}>()

const visibleLocal = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const selectorVisible = ref(false)
const submitting = ref(false)
const selectedUser = ref<SelectedUser | null>(null)

watch(() => props.modelValue, (v) => {
  if (v) {
    selectedUser.value = null
    submitting.value = false
  }
})

function onSelectUser(users: SelectedUser[]) {
  selectedUser.value = users[0] ?? null
}

async function handleConfirm() {
  if (!selectedUser.value) return
  submitting.value = true
  try {
    const res = await apiInitiateDocumentTransfer(props.documentId, selectedUser.value.id)
    if (res.success) {
      msgSuccess(res.message || `已发送转移请求至「${selectedUser.value.name}」`)
      emit('success')
      visibleLocal.value = false
    } else {
      msgError(res.message || '发送转移请求失败')
    }
  } catch {
    msgError('发送转移请求失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.otm-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.otm-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.otm-label {
  width: 72px;
  color: var(--df-subtext);
  line-height: 32px;
  flex-shrink: 0;
}

.otm-value {
  flex: 1;
  line-height: 32px;
  color: var(--df-text);
  word-break: break-all;
}

.otm-picker {
  flex: 1;
  display: flex;
  gap: 8px;
}

.otm-tip {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--df-primary-soft);
  color: var(--df-subtext);
  font-size: 12px;
  line-height: 1.6;
}
</style>
