<template>
	<el-drawer v-model="visible" title="历史记录" size="380px" :destroy-on-close="true" class="df-detail-drawer">
		<!-- 创建快照 -->
		<div class="snapshot-drawer__toolbar">
			<el-button size="small" type="primary" :loading="creating" @click="handleCreateSnapshot">
				+ 保存快照
			</el-button>
		</div>

		<div v-loading="loading" class="snapshot-drawer__body">
			<el-scrollbar>
				<div v-if="list.length" class="snapshot-timeline">
					<div
v-for="item in list" :key="`${item.kind}-${item.id}`" class="snapshot-item"
						:class="{ 'snapshot-item--version': item.kind === 'version' }">
						<div class="snapshot-item__dot" :class="{ 'snapshot-item__dot--version': item.kind === 'version' }" />
						<div class="snapshot-item__card">
							<div class="snapshot-item__header">
								<span class="snapshot-item__label">
									{{ item.kind === 'version' ? `${item.label} 发布` : item.label }}
								</span>
								<span class="snapshot-item__author">{{ item.authorName }}</span>
							</div>
							<div class="snapshot-item__time">{{ formatTime(item.createdAt) }}</div>
							<div class="snapshot-item__actions">
								<el-button size="small" link @click="handlePreview(item)">预览</el-button>
								<el-button
size="small" link type="danger" :loading="restoringId === item.id"
									@click="handleRestore(item)">
									还原
								</el-button>
							</div>
						</div>
					</div>
				</div>
				<EmptyState v-else-if="!loading" preset="no-content" title="暂无历史记录" compact />
			</el-scrollbar>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import {
	apiGetDocSnapshots,
	apiCreateSnapshot,
	apiGetSnapshotPreview,
	apiRestoreSnapshot,
	apiRestoreVersionToDraft,
} from '~/api/documents'
import type { SnapshotTimelineItem } from '~/api/documents'
import { formatTime } from '~/utils/format'

const props = defineProps<{ docId: number }>()

const emit = defineEmits<{
	preview: [html: string, name: string]
	restored: []
}>()

const visible = defineModel<boolean>({ default: false })

const loading = ref(false)
const creating = ref(false)
const restoringId = ref<number | null>(null)
const list = ref<SnapshotTimelineItem[]>([])

const { msgSuccess, msgError, msgConfirm } = useNotify()

async function load() {
	loading.value = true
	try {
		const res = await apiGetDocSnapshots(props.docId)
		if (res.success) list.value = res.data.list
	} finally {
		loading.value = false
	}
}

watch(visible, (val) => {
	if (val) load()
})

async function handleCreateSnapshot() {
	let name: string
	try {
		const { value } = await ElMessageBox.prompt('请输入快照名称', '保存快照', {
			inputPlaceholder: '如：上线前备份',
			inputValidator: (v: string) => v.trim().length > 0 || '名称不能为空',
			confirmButtonText: '保存',
			cancelButtonText: '取消',
		})
		name = value.trim()
	} catch {
		return
	}

	creating.value = true
	try {
		const res = await apiCreateSnapshot(props.docId, name.trim())
		if (res.success) {
			msgSuccess('快照已保存')
			await load()
		} else {
			msgError(res.message || '保存失败')
		}
	} finally {
		creating.value = false
	}
}

async function handlePreview(item: SnapshotTimelineItem) {
	if (item.kind === 'snapshot') {
		const res = await apiGetSnapshotPreview(props.docId, item.id)
		if (res.success) {
			emit('preview', res.data.html, res.data.name ?? item.label)
		} else {
			msgError(res.message || '加载预览失败')
		}
	} else {
		msgError('版本预览暂不支持，请使用「还原」后在编辑器查看')
	}
}

async function handleRestore(item: SnapshotTimelineItem) {
	const confirmMsg = item.kind === 'version'
		? `该还原仅影响编辑中的文档，不会影响已发布的版本。确认还原到 ${item.label}？`
		: `确定还原到快照「${item.label}」？`

	const ok = await msgConfirm(confirmMsg, '还原确认').catch(() => false)
	if (!ok) return

	restoringId.value = item.id
	try {
		const res = item.kind === 'snapshot'
			? await apiRestoreSnapshot(props.docId, item.id)
			: await apiRestoreVersionToDraft(props.docId, item.id)

		if (res.success) {
			msgSuccess(res.message || '已还原')
			emit('restored')
		} else {
			msgError(res.message || '还原失败')
		}
	} finally {
		restoringId.value = null
	}
}
</script>

<style lang="scss" scoped>
.snapshot-drawer__toolbar {
	padding: 0 0 12px;
	display: flex;
	justify-content: flex-end;
}

.snapshot-drawer__body {
	flex: 1;
	overflow: hidden;
}

.snapshot-timeline {
	padding-bottom: 16px;
}

.snapshot-item {
	display: flex;
	gap: 12px;
	position: relative;
	padding-bottom: 16px;

	&::before {
		content: '';
		position: absolute;
		left: 5px;
		top: 12px;
		bottom: -4px;
		width: 1px;
		background: var(--df-border);
	}

	&:last-child::before {
		display: none;
	}
}

.snapshot-item__dot {
	width: 11px;
	height: 11px;
	border-radius: 50%;
	background: var(--df-subtext);
	flex-shrink: 0;
	margin-top: 4px;

	&--version {
		background: var(--el-color-success);
		width: 12px;
		height: 12px;
	}
}

.snapshot-item__card {
	flex: 1;
	min-width: 0;
	border: 1px solid var(--df-border);
	border-radius: 6px;
	padding: 8px 10px;
	background: var(--df-panel);

	.snapshot-item--version & {
		border-color: var(--el-color-success-light-5);
	}
}

.snapshot-item__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 4px;
}

.snapshot-item__label {
	font-size: 13px;
	font-weight: 500;
	color: var(--df-text);

	.snapshot-item--version & {
		font-weight: 600;
	}
}

.snapshot-item__author {
	font-size: 11px;
	color: var(--df-subtext);
	white-space: nowrap;
}

.snapshot-item__time {
	font-size: 11px;
	color: var(--df-subtext);
	margin-top: 2px;
}

.snapshot-item__actions {
	margin-top: 6px;
	display: flex;
	gap: 4px;
}
</style>
