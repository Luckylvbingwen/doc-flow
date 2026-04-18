<template>
	<div class="df-approval-card" :class="`is-${tab}`">
		<!-- 左：文件类型图标 -->
		<div class="df-approval-card__icon" :class="fileTypeClass">
			{{ fileTypeLabel }}
		</div>

		<!-- 中：文件信息 -->
		<div class="df-approval-card__main">
			<div class="df-approval-card__title-row">
				<span class="df-approval-card__title" :title="item.title">{{ item.title }}</span>
				<span
					class="df-approval-card__change-badge"
					:style="{ color: changeMeta.color, background: changeMeta.bg }">
					{{ changeMeta.label }}
				</span>
				<span v-if="item.remindCount > 0" class="df-approval-card__remind-badge" :title="`已催办 ${item.remindCount} 次`">
					<el-icon><BellFilled /></el-icon>
					已催办 {{ item.remindCount }} 次
				</span>
			</div>

			<div class="df-approval-card__meta">
				<span>{{ item.groupName }}</span>
				<span class="df-approval-card__sep">·</span>
				<span>{{ timeLabel }}</span>
				<span class="df-approval-card__sep">·</span>
				<span class="df-approval-card__version">◆ {{ item.versionNo }}</span>
			</div>

			<div class="df-approval-card__approver">
				<template v-if="tab === 'pending'">
					<span class="df-approval-card__approver-label">发起人：</span>
					<span>{{ item.initiatorName }}</span>
				</template>
				<template v-else-if="tab === 'submitted'">
					<template v-if="item.status === 2 && item.currentApproverName">
						<span class="df-approval-card__approver-label">待审批人：</span>
						<span>{{ item.currentApproverName }}</span>
					</template>
					<template v-else-if="item.allApproverNames">
						<span class="df-approval-card__approver-label">审批人：</span>
						<span>{{ item.allApproverNames }}</span>
					</template>
				</template>
				<template v-else>
					<span class="df-approval-card__approver-label">提交人：</span>
					<span>{{ item.initiatorName }}</span>
				</template>
			</div>

			<div v-if="item.rejectReason" class="df-approval-card__reject-reason">
				<el-icon><CircleCloseFilled /></el-icon>
				<span>驳回原因：{{ item.rejectReason }}</span>
			</div>
		</div>

		<!-- 右：状态 + 操作 -->
		<div class="df-approval-card__actions">
			<span
				class="df-approval-card__status"
				:style="{ color: statusMeta.color, background: statusMeta.bg }">
				{{ statusMeta.label }}
			</span>
			<el-button
				v-if="item.canWithdraw"
				type="danger"
				text
				size="small"
				:loading="withdrawing"
				@click="$emit('withdraw', item.id)">
				撤回
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { BellFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import { formatTime } from '~/utils/format'
import { getStatusMeta, getChangeTypeMeta } from '~/utils/approval-meta'
import type { ApprovalItem, ApprovalTab } from '~/types/approval'

const props = defineProps<{
	item: ApprovalItem
	tab: ApprovalTab
	withdrawing?: boolean
}>()

defineEmits<{
	withdraw: [id: number]
}>()

const statusMeta = computed(() => getStatusMeta(props.item.status))
const changeMeta = computed(() => getChangeTypeMeta(props.item.changeType))

const fileTypeClass = computed(() => {
	const e = (props.item.ext || '').toLowerCase()
	if (e === 'pdf') return 'is-pdf'
	if (e === 'doc' || e === 'docx') return 'is-word'
	if (e === 'xls' || e === 'xlsx') return 'is-excel'
	if (e === 'md') return 'is-md'
	return 'is-other'
})

const fileTypeLabel = computed(() => (props.item.ext || 'FILE').toUpperCase())

// pending / submitted：显示"提交于"；handled：显示"处理于"
const timeLabel = computed(() => {
	if (props.tab === 'handled' && props.item.handledAt) {
		return `处理于 ${formatTime(props.item.handledAt, 'YYYY-MM-DD HH:mm')}`
	}
	return `提交于 ${formatTime(props.item.submittedAt, 'YYYY-MM-DD HH:mm')}`
})
</script>

<style lang="scss" scoped>
.df-approval-card {
	display: flex;
	gap: 14px;
	align-items: flex-start;
	padding: 16px 18px;
	background: var(--df-panel);
	border: 1px solid var(--df-border);
	border-radius: 10px;
	transition: box-shadow 0.2s, border-color 0.2s;

	&:hover {
		border-color: var(--df-primary);
		box-shadow: 0 6px 16px -10px rgba(37, 99, 235, 0.3);
	}

	&__icon {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 600;
		color: #fff;
		background: #94a3b8;

		&.is-pdf { background: #ef4444; }
		&.is-word { background: #2563eb; }
		&.is-excel { background: #10b981; }
		&.is-md { background: #8b5cf6; }
	}

	&__main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	&__title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	&__title {
		font-weight: 500;
		color: var(--df-text);
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	&__change-badge,
	&__status {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 12px;
		font-weight: 500;
		line-height: 1.5;
	}

	&__remind-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 12px;
		color: #b91c1c;
		background: #fee2e2;

		.el-icon {
			font-size: 12px;
		}
	}

	&__meta {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--df-subtext);
		font-size: 13px;
		flex-wrap: wrap;
	}

	&__sep {
		color: var(--df-border);
	}

	&__version {
		color: var(--df-primary);
		font-variant-numeric: tabular-nums;
	}

	&__approver {
		font-size: 13px;
		color: var(--df-text);
	}

	&__approver-label {
		color: var(--df-subtext);
	}

	&__reject-reason {
		margin-top: 4px;
		padding: 8px 10px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		color: #991b1b;
		font-size: 12px;
		display: flex;
		align-items: flex-start;
		gap: 6px;

		.el-icon {
			flex-shrink: 0;
			margin-top: 2px;
			color: #ef4444;
		}
	}

	&__actions {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 10px;
	}
}
</style>
