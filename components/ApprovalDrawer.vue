<template>
	<DetailDrawer v-model="visible" :title="drawerTitle" size="600px" destroy-on-close @close="onClose">
		<template v-if="approval">
			<!-- Section 1: 文档信息 -->
			<div class="df-approval-section">
				<div class="df-approval-section__title">
					<el-icon :size="15">
						<Document />
					</el-icon>
					文档信息
				</div>
				<div class="df-approval-info-grid">
					<div class="df-approval-info-item">
						<span class="df-approval-info-label">文件名</span>
						<span class="df-approval-info-value">{{ approval.fileName }}</span>
					</div>
					<div class="df-approval-info-item">
						<span class="df-approval-info-label">所属组</span>
						<span class="df-approval-info-value">{{ approval.repo }}</span>
					</div>
					<div class="df-approval-info-item">
						<span class="df-approval-info-label">上传者</span>
						<span class="df-approval-info-value">{{ approval.uploader }}</span>
					</div>
					<div class="df-approval-info-item">
						<span class="df-approval-info-label">上传时间</span>
						<span class="df-approval-info-value">{{ approval.uploadTime }}</span>
					</div>
					<div class="df-approval-info-item">
						<span class="df-approval-info-label">版本</span>
						<span class="df-approval-info-value">
							<el-tag size="small" type="primary" effect="plain">
								{{ approval.version }}
							</el-tag>
						</span>
					</div>
					<div class="df-approval-info-item">
						<span class="df-approval-info-label">文件类型</span>
						<span class="df-approval-info-value">
							{{ fileTypeLabel }}
						</span>
					</div>
				</div>
				<div class="df-approval-file-actions">
					<el-button size="small" type="primary" plain @click="$emit('viewFile', approval)">
						<el-icon>
							<View />
						</el-icon>
						查看文件
					</el-button>
					<el-button size="small" plain @click="$emit('compare', approval)">
						<el-icon>
							<Switch />
						</el-icon>
						全屏对比
					</el-button>
				</div>
			</div>

			<!-- Section 2: 版本变更摘要 -->
			<div v-if="approval.changes.length > 0" class="df-approval-section">
				<div class="df-approval-section__title">
					<el-icon :size="15">
						<List />
					</el-icon>
					版本变更摘要
					<span v-if="approval.prevVersion" class="df-approval-section__sub">
						{{ approval.version }} vs {{ approval.prevVersion }}
					</span>
				</div>

				<!-- 统计 badge -->
				<div class="df-approval-change-stats">
					<span v-if="addCount > 0" class="df-change-badge df-change-badge--add">
						+ 新增 {{ addCount }} 处
					</span>
					<span v-if="modCount > 0" class="df-change-badge df-change-badge--mod">
						~ 修改 {{ modCount }} 处
					</span>
					<span v-if="delCount > 0" class="df-change-badge df-change-badge--del">
						- 删除 {{ delCount }} 处
					</span>
					<span v-if="approval.sizeChange" class="df-change-badge df-change-badge--size">
						<el-icon :size="12">
							<Coin />
						</el-icon>
						{{ approval.sizeChange }}
					</span>
				</div>

				<!-- 变更明细列表 -->
				<div class="df-approval-change-list">
					<div class="df-approval-change-list__header">
						<el-icon :size="13">
							<Memo />
						</el-icon>
						变更明细
					</div>
					<div v-for="(item, idx) in approval.changes" :key="idx" class="df-approval-change-item"
						:class="`df-approval-change-item--${item.type}`">
						<span class="df-approval-change-icon">
							{{ item.type === 'add' ? '+' : item.type === 'del' ? '−' : '~' }}
						</span>
						<span class="df-approval-change-text">{{ item.text }}</span>
					</div>
				</div>

				<div class="df-approval-compare-link">
					<el-button link type="primary" @click="$emit('compare', approval)">
						打开全屏对比查看
						<el-icon>
							<ArrowRight />
						</el-icon>
					</el-button>
				</div>
			</div>

			<!-- Section 3: 审批链进度 -->
			<div v-if="approval.chain.length > 0" class="df-approval-section">
				<div class="df-approval-section__title">
					<el-icon :size="15">
						<Finished />
					</el-icon>
					审批链进度
				</div>
				<ApprovalChain :nodes="approval.chain" />
			</div>

			<!-- Section 4: 审批意见 -->
			<div v-if="approval.status === 'pending'" class="df-approval-section">
				<div class="df-approval-section__title">
					<el-icon :size="15">
						<ChatLineSquare />
					</el-icon>
					审批意见
					<span v-if="rejectAttempted && !opinion.trim()" class="df-approval-required-tip">
						驳回时必须填写意见
					</span>
				</div>
				<el-input ref="opinionRef" v-model="opinion" type="textarea" :rows="3" :maxlength="500" show-word-limit
					placeholder="输入审批意见（驳回时必填）…" resize="none"
					:class="{ 'df-approval-opinion--error': rejectAttempted && !opinion.trim() }" />
			</div>
		</template>

		<template v-if="approval?.status === 'pending'" #footer>
			<el-button @click="visible = false">取消</el-button>
			<el-button type="danger" :loading="rejectLoading" @click="handleReject">
				<el-icon>
					<CloseBold />
				</el-icon>
				驳回
			</el-button>
			<el-button type="success" :loading="approveLoading" @click="handleApprove">
				<el-icon><Select /></el-icon>
				通过
			</el-button>
		</template>
	</DetailDrawer>
</template>

<script setup lang="ts">
import {
	Document,
	View,
	Switch,
	List,
	Coin,
	Memo,
	ArrowRight,
	Finished,
	ChatLineSquare,
	CloseBold,
	Select,
} from '@element-plus/icons-vue'
import type { ApprovalDetail } from '~/types/approval'

const props = withDefaults(
	defineProps<{
		modelValue: boolean
		approval: ApprovalDetail | null
		approveLoading?: boolean
		rejectLoading?: boolean
	}>(),
	{
		approval: null,
		approveLoading: false,
		rejectLoading: false,
	}
)

const emit = defineEmits<{
	'update:modelValue': [value: boolean]
	approve: [payload: { id: number | string; opinion: string }]
	reject: [payload: { id: number | string; opinion: string }]
	viewFile: [approval: ApprovalDetail]
	compare: [approval: ApprovalDetail]
}>()

const visible = computed({
	get: () => props.modelValue,
	set: (val) => emit('update:modelValue', val),
})

const opinion = ref('')
const rejectAttempted = ref(false)
const opinionRef = ref()

const FILE_TYPE_LABELS: Record<string, string> = {
	docx: 'Word 文档',
	xlsx: 'Excel 表格',
	pdf: 'PDF 文档',
	md: 'Markdown',
	txt: '纯文本',
}

const drawerTitle = computed(() => {
	if (!props.approval) return '审批详情'
	return `审批详情 - ${props.approval.fileName}`
})

const fileTypeLabel = computed(() => {
	if (!props.approval) return ''
	return FILE_TYPE_LABELS[props.approval.fileType] || props.approval.fileType.toUpperCase()
})

const addCount = computed(() => props.approval?.changes.filter((c) => c.type === 'add').length ?? 0)
const modCount = computed(() => props.approval?.changes.filter((c) => c.type === 'mod').length ?? 0)
const delCount = computed(() => props.approval?.changes.filter((c) => c.type === 'del').length ?? 0)

function handleApprove() {
	if (!props.approval) return
	emit('approve', { id: props.approval.id, opinion: opinion.value.trim() })
}

function handleReject() {
	if (!props.approval) return
	rejectAttempted.value = true
	if (!opinion.value.trim()) {
		nextTick(() => {
			opinionRef.value?.$el?.querySelector('textarea')?.focus()
		})
		return
	}
	emit('reject', { id: props.approval.id, opinion: opinion.value.trim() })
}

function onClose() {
	opinion.value = ''
	rejectAttempted.value = false
}

// 切换审批对象时重置
watch(
	() => props.approval?.id,
	() => {
		opinion.value = ''
		rejectAttempted.value = false
	}
)
</script>
