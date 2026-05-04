<template>
  <Modal
v-model="visible" title="权限申请审批" width="720px" :destroy-on-close="true" confirm-text="关闭" cancel-text="关闭"
    @confirm="visible = false">
    <div class="prm__head">
      <div class="prm__title">待处理申请</div>
      <el-button size="small" :loading="loading" @click="loadRequests">刷新</el-button>
    </div>

    <div v-if="loading" class="prm__loading">
      <el-icon class="is-loading" :size="18">
        <Loading />
      </el-icon>
      <span>加载中...</span>
    </div>

    <EmptyState v-else-if="requests.length === 0" preset="no-data" title="暂无待处理申请" description="当前文档没有新的权限申请" compact />

    <div v-else class="prm__list">
      <div v-for="item in requests" :key="item.id" class="prm__item">
        <div class="prm__item-main">
          <div class="prm__user">
            <el-avatar :size="28" :src="item.avatarUrl || undefined">
              {{ (item.userName || '?').slice(0, 1) }}
            </el-avatar>
            <div>
              <div class="prm__name">{{ item.userName || '未知用户' }}</div>
              <div class="prm__meta">
                {{ permissionTypeText(item.type) }} · {{ formatTime(item.createdAt, 'YYYY-MM-DD HH:mm') }}
              </div>
            </div>
          </div>
          <p v-if="item.reason" class="prm__reason">申请说明：{{ item.reason }}</p>
        </div>
        <div class="prm__ops">
          <el-button
size="small" type="danger" plain :loading="actingId === item.id && actingAction === 'reject'"
            @click="review(item.id, 'reject')">
            拒绝
          </el-button>
          <el-button
size="small" type="primary" :loading="actingId === item.id && actingAction === 'approve'"
            @click="review(item.id, 'approve')">
            同意
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import { apiGetPermissionRequests, apiReviewPermissionRequest } from '~/api/documents'
import type { DocumentPermissionRequestItem } from '~/types/document'
import { formatTime } from '~/utils/format'

const props = defineProps<{
  modelValue: boolean
  documentId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  reviewed: []
}>()

const { msgError, msgSuccess, msgConfirm } = useNotify()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const loading = ref(false)
const requests = ref<DocumentPermissionRequestItem[]>([])
const actingId = ref<string>('')
const actingAction = ref<'approve' | 'reject' | ''>('')

function permissionTypeText(type: 1 | 2): string {
  return type === 1 ? '申请阅读权限' : '申请编辑权限'
}

async function loadRequests() {
  loading.value = true
  try {
    const res = await apiGetPermissionRequests(props.documentId)
    if (res.success) {
      requests.value = res.data
    } else {
      msgError(res.message || '加载权限申请失败')
    }
  } catch {
    msgError('加载权限申请失败')
  } finally {
    loading.value = false
  }
}

async function review(requestId: string, action: 'approve' | 'reject') {
  const ok = await msgConfirm(
    action === 'approve' ? '确认同意该权限申请？' : '确认拒绝该权限申请？',
    action === 'approve' ? '同意申请' : '拒绝申请',
    { type: action === 'approve' ? 'info' : 'warning', confirmText: '确认', danger: action === 'reject' },
  )
  if (!ok) return

  actingId.value = requestId
  actingAction.value = action
  try {
    const res = await apiReviewPermissionRequest(props.documentId, requestId, action)
    if (res.success) {
      msgSuccess(res.message || (action === 'approve' ? '已同意申请' : '已拒绝申请'))
      requests.value = requests.value.filter(item => item.id !== requestId)
      emit('reviewed')
    } else {
      msgError(res.message || '处理申请失败')
    }
  } catch {
    msgError('处理申请失败')
  } finally {
    actingId.value = ''
    actingAction.value = ''
  }
}

watch(visible, (val) => {
  if (val) {
    loadRequests()
  }
})
</script>

<style scoped lang="scss">
.prm__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.prm__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--df-text);
}

.prm__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--df-subtext);
  padding: 16px 0;
}

.prm__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prm__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--df-border);
  border-radius: 10px;
  background: var(--df-panel);
}

.prm__item-main {
  flex: 1;
  min-width: 0;
}

.prm__user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.prm__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--df-text);
}

.prm__meta {
  font-size: 12px;
  color: var(--df-subtext);
  margin-top: 2px;
}

.prm__reason {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--df-subtext);
}

.prm__ops {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
