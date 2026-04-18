<template>
	<el-collapse v-if="groups.length > 0" class="df-handover">
		<el-collapse-item v-for="g in groups" :key="g.userId" :name="g.userId">
			<template #title>
				<div class="df-handover__head">
					<div class="df-handover__folder">
						<el-icon :size="18">
							<FolderOpened />
						</el-icon>
					</div>
					<div class="df-handover__info">
						<span class="df-handover__name">{{ g.userName }}</span>
						<span class="df-handover__meta">
							{{ g.departmentName }} · 离职于 {{ formatTime(g.leftAt, 'YYYY-MM-DD') }}
						</span>
					</div>
					<span class="df-handover__badge">{{ g.documents.length }} 份待交接</span>
				</div>
			</template>

			<div class="df-handover__body">
				<div v-for="doc in g.documents" :key="doc.id" class="df-handover__doc" @click="$emit('view', doc)">
					<div class="df-handover__doc-icon" :class="getFileTypeClass(doc.ext)">
						{{ getFileTypeLabel(doc.ext) }}
					</div>
					<div class="df-handover__doc-main">
						<span class="df-handover__doc-title">{{ doc.title }}</span>
						<span class="df-handover__doc-meta">
							{{ doc.groupName }} · {{ doc.versionNo }} · {{ formatBytes(doc.fileSize) }}
						</span>
					</div>
					<span
class="df-handover__doc-status"
						:style="{ color: getDocStatusMeta(doc.status).color, background: getDocStatusMeta(doc.status).bg }">
						{{ getDocStatusMeta(doc.status).label }}
					</span>
					<el-button type="primary" text size="small" @click.stop="$emit('view', doc)">查看</el-button>
				</div>
			</div>
		</el-collapse-item>
	</el-collapse>

	<EmptyState v-else preset="no-content" title="暂无离职交接" description="当前部门没有离职人员名下的待交接文档" />
</template>

<script setup lang="ts">
import { FolderOpened } from '@element-plus/icons-vue'
import { formatTime, formatBytes } from '~/utils/format'
import { getFileTypeClass, getFileTypeLabel } from '~/utils/file-type'
import { getDocStatusMeta } from '~/utils/doc-meta'
import type { HandoverGroup, PersonalDocItem } from '~/types/personal'

defineProps<{
	groups: HandoverGroup[]
}>()

defineEmits<{
	view: [doc: PersonalDocItem]
}>()
</script>

<style lang="scss" scoped>
.df-handover {
	border: none;

	:deep(.el-collapse-item) {
		margin-bottom: 8px;
		border: 1px solid var(--df-border);
		border-radius: 10px;
		background: var(--df-panel);
		overflow: hidden;
	}

	:deep(.el-collapse-item__header) {
		padding: 8px 16px;
		background: var(--df-panel);
		border-bottom: none;
		height: auto;
		min-height: 48px;

		&:hover {
			background: var(--df-surface);
		}
	}

	:deep(.el-collapse-item__wrap) {
		border-bottom: none;
		background: var(--df-surface);
	}

	:deep(.el-collapse-item__content) {
		padding: 10px 16px;
	}

	&__head {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		margin-right: 10px; // 与右侧的折叠箭头留出间距
	}

	&__folder {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--df-primary-soft);
		color: var(--df-primary);
	}

	&__info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	&__name {
		font-weight: 500;
		color: var(--df-text);
	}

	&__meta {
		font-size: 12px;
		color: var(--df-subtext);
	}

	&__badge {
		padding: 2px 10px;
		border-radius: 10px;
		background: var(--df-primary-soft);
		color: var(--df-primary);
		font-size: 12px;
		font-weight: 500;
		flex-shrink: 0;
	}

	&__body {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	&__doc {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: var(--df-panel);
		border: 1px solid var(--df-border);
		border-radius: 8px;
		cursor: pointer;
		transition: border-color 0.2s;

		&:hover {
			border-color: var(--df-primary);
		}
	}

	&__doc-icon {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 600;
		color: #fff;
		background: #94a3b8;

		&.is-pdf {
			background: #ef4444;
		}

		&.is-word {
			background: #2563eb;
		}

		&.is-excel {
			background: #10b981;
		}

		&.is-md {
			background: #8b5cf6;
		}
	}

	&__doc-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	&__doc-title {
		font-weight: 500;
		color: var(--df-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__doc-meta {
		font-size: 12px;
		color: var(--df-subtext);
	}

	&__doc-status {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 12px;
		font-weight: 500;
	}
}
</style>
