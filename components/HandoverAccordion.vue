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
				<el-table :data="g.documents" size="small" stripe>
					<el-table-column label="文件名" min-width="180" show-overflow-tooltip>
						<template #default="{ row }">
							<div class="df-handover__file-cell">
								<span class="df-handover__file-ext" :class="getFileTypeClass(row.ext)">
									{{ getFileTypeLabel(row.ext) }}
								</span>
								<span>{{ row.title }}</span>
							</div>
						</template>
					</el-table-column>
					<el-table-column label="版本" width="80" align="center" prop="versionNo" />
					<el-table-column label="状态" width="90" align="center">
						<template #default="{ row }">
							<span
class="df-handover__status-tag"
								:style="{ color: getDocStatusMeta(row.status).color, background: getDocStatusMeta(row.status).bg }">
								{{ getDocStatusMeta(row.status).label }}
							</span>
						</template>
					</el-table-column>
					<el-table-column label="原所属组" min-width="120" show-overflow-tooltip prop="groupName" />
					<el-table-column label="交接日期" width="110" align="center">
						<template #default>
							{{ formatTime(g.leftAt, 'YYYY-MM-DD') }}
						</template>
					</el-table-column>
					<el-table-column label="操作" width="150" align="center">
						<template #default="{ row }">
							<el-button type="primary" text size="small" @click="$emit('view', row)">查看</el-button>
							<el-button type="primary" text size="small" @click="$emit('download', row)">下载</el-button>
							<el-button type="danger" text size="small" @click="$emit('delete', row)">删除</el-button>
						</template>
					</el-table-column>
				</el-table>
			</div>
		</el-collapse-item>
	</el-collapse>

	<EmptyState v-else preset="no-content" title="暂无离职交接" description="当前部门没有离职人员名下的待交接文档" />
</template>

<script setup lang="ts">
import { FolderOpened } from '@element-plus/icons-vue'
import { formatTime } from '~/utils/format'
import { getFileTypeClass, getFileTypeLabel } from '~/utils/file-type'
import { getDocStatusMeta } from '~/utils/doc-meta'
import type { HandoverGroup, PersonalDocItem } from '~/types/personal'

defineProps<{
	groups: HandoverGroup[]
}>()

defineEmits<{
	view: [doc: PersonalDocItem]
	download: [doc: PersonalDocItem]
	delete: [doc: PersonalDocItem]
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
		margin-right: 10px;
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
		:deep(.el-table) {
			--el-table-border-color: var(--df-border);
		}
	}

	&__file-cell {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	&__file-ext {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
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

	&__status-tag {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 12px;
		font-weight: 500;
	}
}
</style>
