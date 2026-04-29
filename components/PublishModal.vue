<template>
	<Modal
v-model="visible" title="提交发布" width="600px" :confirm-loading="submitting" confirm-text="提交发布"
		:confirm-disabled="!canSubmit" @confirm="onSubmit" @cancel="visible = false">
		<div class="pub-modal">
			<!-- 文件信息 -->
			<div class="pub-file-info">
				<span class="pub-file-info__label">发布文件：</span>
				<strong>{{ doc?.title }}</strong>
			</div>

			<!-- 模式选择 -->
			<div class="pub-mode-label">请选择发布类型：</div>
			<div class="pub-mode-cards">
				<div class="pub-mode-card" :class="{ 'pub-mode-card--active': mode === 'new' }" @click="selectMode('new')">
					<el-icon :size="24" color="var(--df-primary)">
						<DocumentAdd />
					</el-icon>
					<div class="pub-mode-card__text">
						<div class="pub-mode-card__title">首次发布</div>
						<div class="pub-mode-card__desc">作为新文件发布到组，自动标记 v1.0</div>
					</div>
				</div>
				<div
class="pub-mode-card" :class="{ 'pub-mode-card--active': mode === 'update' }"
					@click="selectMode('update')">
					<el-icon :size="24" color="var(--df-primary)">
						<Refresh />
					</el-icon>
					<div class="pub-mode-card__text">
						<div class="pub-mode-card__title">版本迭代</div>
						<div class="pub-mode-card__desc">更新已有文件，版本号自动递增</div>
					</div>
				</div>
			</div>

			<!-- Step: 选择目标组 -->
			<template v-if="mode">
				<div class="pub-step-label">选择目标组：</div>
				<DocNavTree v-model="selectedGroupId" :categories="treeData" mode="picker" class="pub-tree" />
			</template>

			<!-- Step: 版本迭代 — 选择目标文件 -->
			<template v-if="mode === 'update' && selectedGroupId">
				<div class="pub-step-label">选择要更新的文件：</div>
				<div v-loading="docsLoading" class="pub-file-list">
					<template v-if="publishedDocs.length > 0">
						<div
v-for="d in publishedDocs" :key="d.id" class="pub-file-item"
							:class="{ 'pub-file-item--active': targetDocId === d.id }" @click="targetDocId = d.id">
							<el-icon :size="14">
								<Document />
							</el-icon>
							<span class="pub-file-item__name">{{ d.title }}</span>
							<span class="pub-file-item__version">{{ d.versionNo || 'v1.0' }}</span>
						</div>
					</template>
					<div v-else-if="!docsLoading" class="pub-file-list__empty">
						该组暂无已发布文件
					</div>
				</div>
			</template>

			<!-- 备注 -->
			<template v-if="mode && selectedGroupId">
				<div class="pub-step-label">备注（可选）：</div>
				<el-input v-model="remark" type="textarea" :rows="2" placeholder="填写发布备注..." maxlength="500" show-word-limit />
			</template>

			<!-- 提示 -->
			<el-alert v-if="mode && selectedGroupId && canSubmit" type="info" :closable="false" show-icon class="pub-hint">
				<template #title>
					{{ mode === 'new'
						? '文件将作为新文件发布到目标组，自动标记为 v1.0。提交后将走审批流（若已配置）。'
						: '选中文件的版本号将自动递增。提交后将走审批流（若已配置）。'
					}}
				</template>
			</el-alert>
		</div>
	</Modal>
</template>

<script setup lang="ts">
import { DocumentAdd, Refresh, Document } from '@element-plus/icons-vue'
import { apiGetGroupTree } from '~/api/groups'
import { apiGetDocuments, apiPublishDocument } from '~/api/documents'
import type { NavTreeCategory } from '~/types/doc-nav-tree'
import type { DocumentListItem } from '~/types/document'
import type { PersonalDocItem } from '~/types/personal'

const props = defineProps<{
	doc: PersonalDocItem | null
}>()

const emit = defineEmits<{
	success: []
}>()

const visible = defineModel<boolean>({ default: false })

const mode = ref<'new' | 'update' | null>(null)
const selectedGroupId = ref<number | null>(null)
const targetDocId = ref<number | null>(null)
const remark = ref('')
const submitting = ref(false)

// Tree data
const treeData = ref<NavTreeCategory[]>([])

// Published docs for update mode
const publishedDocs = ref<DocumentListItem[]>([])
const docsLoading = ref(false)

const canSubmit = computed(() => {
	if (!mode.value || !selectedGroupId.value) return false
	if (mode.value === 'update' && !targetDocId.value) return false
	return true
})

function selectMode(m: 'new' | 'update') {
	mode.value = m
	selectedGroupId.value = null
	targetDocId.value = null
	publishedDocs.value = []
}

// Load published docs when group changes in update mode
watch(selectedGroupId, async (gid) => {
	targetDocId.value = null
	publishedDocs.value = []
	if (!gid || mode.value !== 'update') return

	docsLoading.value = true
	try {
		const res = await apiGetDocuments({ groupId: gid, status: 4, pageSize: 100 })
		if (res.success && res.data) {
			publishedDocs.value = res.data.list
		}
	} finally {
		docsLoading.value = false
	}
})

async function onSubmit() {
	if (!props.doc || !mode.value || !selectedGroupId.value) return
	if (mode.value === 'update' && !targetDocId.value) return

	submitting.value = true
	try {
		const res = await apiPublishDocument(props.doc.id, {
			mode: mode.value,
			targetGroupId: selectedGroupId.value,
			targetDocId: mode.value === 'update' ? targetDocId.value! : undefined,
			remark: remark.value || undefined,
		})
		if (res.success) {
			msgSuccess(res.message || '提交成功')
			visible.value = false
			emit('success')
		} else {
			msgError(res.message || '提交失败')
		}
	} catch {
		msgError('提交失败')
	} finally {
		submitting.value = false
	}
}

// Reset on open, lazy-load tree
watch(visible, async (val) => {
	if (val) {
		mode.value = null
		selectedGroupId.value = null
		targetDocId.value = null
		remark.value = ''
		publishedDocs.value = []
		if (treeData.value.length === 0) {
			const res = await apiGetGroupTree()
			if (res.success) treeData.value = res.data
		}
	}
})
</script>

<style lang="scss" scoped>
.pub-modal {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.pub-file-info {
	font-size: 13px;
	color: var(--df-subtext);

	strong {
		color: var(--df-text);
	}
}

.pub-mode-label,
.pub-step-label {
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
}

.pub-mode-cards {
	display: flex;
	gap: 12px;
}

.pub-mode-card {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px;
	border: 2px solid var(--df-border);
	border-radius: 8px;
	cursor: pointer;
	transition: border-color 0.2s, background 0.2s;

	&:hover {
		border-color: var(--df-primary);
	}

	&--active {
		border-color: var(--df-primary);
		background: var(--df-primary-soft);
	}

	&__text {
		flex: 1;
		min-width: 0;
	}

	&__title {
		font-size: 14px;
		font-weight: 600;
		color: var(--df-text);
	}

	&__desc {
		font-size: 12px;
		color: var(--df-subtext);
		margin-top: 2px;
	}
}

.pub-tree {
	border: 1px solid var(--df-border);
	border-radius: 8px;
	max-height: 280px;
}

.pub-file-list {
	border: 1px solid var(--df-border);
	border-radius: 8px;
	max-height: 200px;
	overflow-y: auto;
	min-height: 80px;

	&__empty {
		padding: 24px;
		text-align: center;
		font-size: 13px;
		color: var(--df-subtext);
	}
}

.pub-file-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 14px;
	cursor: pointer;
	border-bottom: 1px solid var(--df-border);
	transition: background 0.15s;

	&:last-child {
		border-bottom: none;
	}

	&:hover {
		background: var(--df-surface);
	}

	&--active {
		background: var(--df-primary-soft);
		border-color: var(--df-primary);
	}

	&__name {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		color: var(--df-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__version {
		font-size: 12px;
		color: var(--df-subtext);
		flex-shrink: 0;
	}
}

.pub-hint {
	margin-top: 4px;

	:deep(.el-alert__content) {
		font-size: 13px;
	}
}
</style>
