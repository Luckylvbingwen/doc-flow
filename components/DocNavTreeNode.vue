<template>
	<div v-for="group in groups" :key="group.id">
		<!-- Group node -->
		<div
			class="dn-node"
			:class="{
				'is-parent': hasChildren(group),
				'is-active': activeId === group.id,
			}"
			:style="{ paddingLeft: `${indent}px` }"
			@click="$emit('select', group)"
			@contextmenu.prevent="mode === 'nav' ? $emit('context-menu', $event, group) : undefined"
		>
			<span
				v-if="expandable(group)"
				class="dn-arrow"
				:class="{ 'is-collapsed': !expandedMap[group.id] }"
				@click.stop="toggleExpand(group.id)"
			>
				<el-icon :size="12"><ArrowDown /></el-icon>
			</span>
			<span v-else class="dn-arrow-placeholder" />

			<el-icon class="dn-icon" :size="14">
				<FolderOpened v-if="hasChildren(group) && expandedMap[group.id]" />
				<Folder v-else />
			</el-icon>

			<span class="dn-label" :title="group.name">{{ group.name }}</span>

			<!-- Right zone: badge + actions overlay -->
			<span class="dn-right-zone">
				<span class="dn-badge">{{ getBadge(group) }}</span>
				<span v-if="mode === 'nav'" class="dn-hover-actions">
					<button
						class="dn-hover-btn"
						title="新建子组"
						@click.stop="$emit('create', group)"
					>
						<el-icon :size="13"><Plus /></el-icon>
					</button>
					<button
						class="dn-hover-btn"
						title="更多"
						@click.stop="$emit('more', $event, group)"
					>
						<el-icon :size="13"><MoreFilled /></el-icon>
					</button>
				</span>
			</span>
		</div>

		<!-- Children container (recursive) -->
		<div
			v-if="expandable(group)"
			v-show="expandedMap[group.id]"
			class="dn-children"
		>
			<!-- Sub-groups (recursive) -->
			<DocNavTreeNode
				v-if="group.children?.length"
				:groups="group.children"
				:depth="depth + 1"
				:mode="mode"
				:active-id="activeId"
				:expanded-map="expandedMap"
				:search-keyword="searchKeyword"
				:exclude-id="excludeId"
				@select="$emit('select', $event)"
				@create="$emit('create', $event)"
				@more="(ev, g) => $emit('more', ev, g)"
				@context-menu="(ev, g) => $emit('context-menu', ev, g)"
				@toggle="$emit('toggle', $event)"
			/>

			<!-- File nodes (nav mode only) -->
			<template v-if="mode === 'nav' && group.files?.length">
				<div
					v-for="file in group.files"
					:key="`f_${file.id}`"
					class="dn-node dn-file-node"
					:style="{ paddingLeft: `${indent + 24}px` }"
					@click="$emit('select', group, file)"
				>
					<span class="dn-arrow-placeholder" />
					<span
						class="dn-file-type-badge"
						:class="file.type"
					>{{ getTypeLabel(file.type) }}</span>
					<span class="dn-label dn-file-label" :title="file.name">{{ file.name }}</span>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ArrowDown, FolderOpened, Folder, Plus, MoreFilled } from '@element-plus/icons-vue'
import type { NavTreeGroup, NavTreeFile } from '~/types/doc-nav-tree'

const props = defineProps<{
	groups: NavTreeGroup[]
	depth: number
	mode: 'nav' | 'picker'
	activeId?: number | null
	expandedMap: Record<number | string, boolean>
	searchKeyword?: string
	excludeId?: number | null
}>()

const emit = defineEmits<{
	select: [group: NavTreeGroup, file?: NavTreeFile]
	create: [group: NavTreeGroup]
	more: [event: MouseEvent, group: NavTreeGroup]
	'context-menu': [event: MouseEvent, group: NavTreeGroup]
	toggle: [id: number | string]
}>()

const indent = computed(() => 12 + props.depth * 20)

const TYPE_LABELS: Record<string, string> = {
	pdf: 'PDF',
	md: 'MD',
	doc: 'W',
	docx: 'W',
	xls: 'XLS',
	xlsx: 'XLS',
	ppt: 'PPT',
	pptx: 'PPT',
}

function hasChildren(group: NavTreeGroup) {
	return (group.children?.length ?? 0) > 0
}

function expandable(group: NavTreeGroup) {
	if (props.mode === 'picker') return hasChildren(group)
	return hasChildren(group) || (group.files?.length ?? 0) > 0
}

function getBadge(group: NavTreeGroup) {
	if (group.fileCount != null && group.fileCount > 0) return group.fileCount
	if (hasChildren(group)) return group.children!.length
	return ''
}

function getTypeLabel(type: string) {
	return TYPE_LABELS[type?.toLowerCase()] || type?.toUpperCase() || '?'
}

function toggleExpand(id: number) {
	emit('toggle', id)
}
</script>

<style lang="scss" scoped>
/* ── Group node ── */
.dn-node {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 7px 12px;
	font-size: 13px;
	cursor: pointer;
	transition:
		background 0.15s,
		color 0.15s;
	border-left: 3px solid transparent;
	color: var(--df-subtext);
	user-select: none;
	line-height: 1.4;

	&:hover {
		background: color-mix(in srgb, var(--df-primary) 6%, transparent);
		color: var(--df-text);

		.dn-hover-actions {
			opacity: 1;
			pointer-events: auto;
		}

		.dn-badge {
			opacity: 0;
		}
	}

	&.is-active {
		background: var(--df-primary-soft);
		color: var(--df-primary);
		border-left-color: var(--df-primary);
		font-weight: 600;
	}

	&.is-parent .dn-label {
		font-weight: 600;
		color: var(--df-text);
	}
}

/* ── File node ── */
.dn-file-node {
	padding-top: 4px;
	padding-bottom: 4px;
	font-size: 12px;
	border-left-color: transparent !important;

	.dn-file-label {
		font-weight: 400;
		color: var(--df-subtext);
		font-size: 12px;
	}

	&:hover .dn-file-label {
		color: var(--df-primary);
	}
}

/* ── Arrow ── */
.dn-arrow {
	width: 16px;
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: var(--df-subtext);
	transition: transform 0.2s;

	&.is-collapsed {
		transform: rotate(-90deg);
	}
}

.dn-arrow-placeholder {
	width: 16px;
	flex-shrink: 0;
}

/* ── Folder icon ── */
.dn-icon {
	flex-shrink: 0;
	color: #f59e0b;
}

/* ── Label ── */
.dn-label {
	flex: 1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	min-width: 0;
}

/* ── Right zone (badge + actions stacked) ── */
.dn-right-zone {
	position: relative;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	min-width: 48px;
	height: 22px;
}

.dn-badge {
	font-size: 11px;
	color: var(--df-subtext);
	min-width: 16px;
	text-align: right;
	transition: opacity 0.15s;
}

.dn-hover-actions {
	position: absolute;
	right: 0;
	top: 0;
	display: flex;
	align-items: center;
	gap: 2px;
	height: 100%;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.15s;
}

.dn-hover-btn {
	width: 22px;
	height: 22px;
	border: none;
	background: transparent;
	border-radius: 4px;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: var(--df-subtext);
	transition:
		background 0.15s,
		color 0.15s;
	padding: 0;
	outline: none;
	font-size: 0;

	&:hover {
		background: var(--df-primary-soft);
		color: var(--df-primary);
	}
}

/* ── Children container ── */
.dn-children {
	overflow: hidden;
}

/* ── File type badge ── */
.dn-file-type-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 18px;
	font-size: 8px;
	font-weight: 700;
	border-radius: 3px;
	flex-shrink: 0;
	color: #fff;
	background: #94a3b8;
	letter-spacing: -0.3px;
	line-height: 1;

	&.pdf {
		background: #ef4444;
	}

	&.md {
		background: #3b82f6;
	}

	&.doc,
	&.docx {
		background: #2563eb;
	}

	&.xls,
	&.xlsx {
		background: #16a34a;
	}

	&.ppt,
	&.pptx {
		background: #ea580c;
	}
}
</style>
