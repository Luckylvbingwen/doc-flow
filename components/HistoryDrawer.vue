<template>
	<el-drawer v-model="visible" title="历史记录" size="420px" :destroy-on-close="true" class="df-detail-drawer">
		<div v-loading="loading" class="df-history-body">
			<el-scrollbar>
				<div v-if="list.length" class="df-history-timeline">
					<div v-for="item in list" :key="item.id" class="df-history-item">
						<div class="df-history-item__dot" />
						<div class="df-history-item__content">
							<div class="df-history-item__header">
								<span class="df-history-item__actor">{{ item.actorName }}</span>
								<span class="df-history-item__time">{{ formatTime(item.createdAt) }}</span>
							</div>
							<div class="df-history-item__desc">{{ item.description }}</div>
						</div>
					</div>
				</div>
				<EmptyState v-else-if="!loading" preset="no-content" title="暂无操作记录" compact />
			</el-scrollbar>
		</div>
		<div v-if="total > pageSize" class="df-history-footer">
			<el-pagination
v-model:current-page="page" :page-size="pageSize" :total="total" small layout="prev, pager, next"
				@current-change="fetchHistory" />
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { apiGetDocumentHistory } from '~/api/documents'
import type { DocHistoryItem } from '~/api/documents'
import { formatTime } from '~/utils/format'

const props = defineProps<{
	documentId: number
}>()

const visible = defineModel<boolean>({ default: false })

const loading = ref(false)
const list = ref<DocHistoryItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20

async function fetchHistory() {
	loading.value = true
	try {
		const res = await apiGetDocumentHistory(props.documentId, {
			page: page.value,
			pageSize,
		})
		if (res.success) {
			list.value = res.data.list
			total.value = res.data.total
		}
	} finally {
		loading.value = false
	}
}

watch(visible, (val) => {
	if (val) {
		page.value = 1
		fetchHistory()
	}
})
</script>
