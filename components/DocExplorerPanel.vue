<template>
	<el-scrollbar class="doc-panel">
		<!-- Empty state -->
		<div v-if="type === 'empty'" class="doc-panel__empty">
			<el-icon :size="52" color="var(--df-subtext)" style="opacity: 0.25">
				<FolderOpened />
			</el-icon>
			<p class="doc-panel__empty-text">请在左侧选择目标</p>
		</div>

		<!-- Category / Department / ProductLine views -->
		<div v-else-if="type === 'category' || type === 'department' || type === 'productline'" class="doc-panel__section">
			<!-- Header -->
			<div class="doc-panel__header">
				<div class="doc-panel__header-icon">
					<el-icon :size="20">
						<OfficeBuilding v-if="type === 'category'" />
						<Folder v-else-if="type === 'department'" />
						<Box v-else />
					</el-icon>
				</div>
				<div class="doc-panel__header-info">
					<div class="doc-panel__title-row">
						<h3 class="doc-panel__title">{{ data?.label || data?.name }}</h3>
						<!-- 管理按钮紧跟标题 -->
						<el-button
v-if="type === 'category' && data?.scope === 'company'" size="small"
							@click="$emit('admin-settings')">
							<el-icon :size="13">
								<Setting />
							</el-icon>
							管理员设置
						</el-button>
						<el-button v-else-if="type === 'department'" size="small" @click="$emit('manage-entity')">
							部门管理
						</el-button>
						<el-button v-else-if="type === 'productline'" size="small" @click="$emit('manage-entity')">
							产品线管理
						</el-button>
					</div>
					<p v-if="type === 'productline' && data?.description" class="doc-panel__desc">
						{{ data.description }}
					</p>
					<div v-if="(type === 'productline' || type === 'department') && data?.ownerName" class="doc-panel__meta-row">
						<el-icon :size="13">
							<User />
						</el-icon>
						<span>负责人: {{ data.ownerName }}</span>
					</div>
				</div>
			</div>

			<!-- Action buttons -->
			<div class="doc-panel__action-bar">
				<el-button
v-if="type === 'category' && data?.scope === 'company'" type="primary" size="small"
					@click="$emit('create-group')">
					<el-icon :size="13">
						<Plus />
					</el-icon>
					创建组
				</el-button>
				<el-button
v-else-if="type === 'category' && data?.scope === 'productline'" type="primary" size="small"
					@click="$emit('create-product-line')">
					<el-icon :size="13">
						<Plus />
					</el-icon>
					创建产品线
				</el-button>
				<el-button
v-else-if="type === 'department' || type === 'productline'" type="primary" size="small"
					@click="$emit('create-group')">
					<el-icon :size="13">
						<Plus />
					</el-icon>
					创建组
				</el-button>
			</div>

			<!-- Group cards grid -->
			<div v-if="groups && groups.length > 0" class="doc-panel__grid-label">
				<el-icon :size="14">
					<Folder />
				</el-icon>
				<span>下属组 ({{ groups.length }})</span>
			</div>
			<div v-if="groups && groups.length > 0" class="doc-panel__grid">
				<article v-for="group in groups" :key="group.id" class="doc-panel__card" @click="$emit('group-click', group)">
					<div class="doc-panel__card-head">
						<el-icon :size="16" class="doc-panel__card-icon">
							<Folder />
						</el-icon>
						<h5 class="doc-panel__card-name">{{ group.name }}</h5>
					</div>
					<p v-if="group.desc || group.description" class="doc-panel__card-desc">
						{{ group.desc || group.description }}
					</p>
					<div class="doc-panel__card-footer">
						<span v-if="group.owner || group.ownerName" class="doc-panel__card-meta">
							<el-icon :size="12">
								<User />
							</el-icon>
							{{ group.owner || group.ownerName }}
						</span>
						<span class="doc-panel__card-meta">
							<el-icon :size="12">
								<Document />
							</el-icon>
							{{ group.fileCount ?? 0 }} 个文件
						</span>
					</div>
				</article>
			</div>
			<div v-else class="doc-panel__no-groups">
				<el-icon :size="36" color="var(--df-subtext)" style="opacity: 0.3">
					<Folder />
				</el-icon>
				<p>暂无下属组</p>
			</div>
		</div>

		<!-- Group detail view -->
		<div v-else-if="type === 'group'" class="doc-panel__section">
			<div class="doc-panel__group-detail">
				<!-- 面包屑导航 -->
				<nav v-if="breadcrumb && breadcrumb.length > 0" class="doc-panel__breadcrumb">
					<template v-for="(item, idx) in breadcrumb" :key="idx">
						<span v-if="idx > 0" class="doc-panel__breadcrumb-sep">/</span>
						<a v-if="item.clickable" class="doc-panel__breadcrumb-link" @click="$emit('breadcrumb-click', item)">{{
							item.label }}</a>
						<span v-else class="doc-panel__breadcrumb-current">{{ item.label }}</span>
					</template>
				</nav>

				<!-- Group header -->
				<div class="doc-panel__header">
					<div class="doc-panel__header-icon doc-panel__header-icon--group">
						<el-icon :size="22">
							<FolderOpened />
						</el-icon>
					</div>
					<div class="doc-panel__header-info">
						<div class="doc-panel__title-row">
							<h3 class="doc-panel__title">{{ data?.name }}</h3>
							<el-button size="small" @click="$emit('group-settings')">
								<el-icon :size="13">
									<Setting />
								</el-icon>
								设置
							</el-button>
						</div>
						<p v-if="data?.description || data?.desc" class="doc-panel__desc">
							{{ data.description || data.desc }}
						</p>
					</div>
				</div>

				<!-- Meta info -->
				<div class="doc-panel__meta">
					<div class="doc-panel__meta-item">
						<el-icon :size="14">
							<User />
						</el-icon>
						<span class="doc-panel__meta-label">负责人</span>
						<span class="doc-panel__meta-value">{{ data?.ownerName || data?.owner || '-' }}</span>
					</div>
					<div class="doc-panel__meta-item">
						<el-icon :size="14">
							<Document />
						</el-icon>
						<span class="doc-panel__meta-label">文档数量</span>
						<span class="doc-panel__meta-value">{{ data?.fileCount ?? 0 }}</span>
					</div>
					<div class="doc-panel__meta-item">
						<el-icon :size="14">
							<Clock />
						</el-icon>
						<span class="doc-panel__meta-label">创建时间</span>
						<span class="doc-panel__meta-value">{{ formatTime(data?.createdAt, 'YYYY-MM-DD') }}</span>
					</div>
				</div>

				<!-- Action -->
				<div class="doc-panel__actions">
					<el-button type="primary" @click="$emit('create-group')">
						<el-icon :size="14">
							<Plus />
						</el-icon>
						创建子组
					</el-button>
					<NuxtLink v-if="data?.id" class="doc-panel__enter-btn" :to="`/docs/repo/${data.id}`">
						<el-icon :size="14">
							<Right />
						</el-icon>
						进入仓库
					</NuxtLink>
				</div>

				<!-- Sub-groups (if any) -->
				<template v-if="groups && groups.length > 0">
					<div class="doc-panel__grid-label" style="margin-top: 28px;">
						<el-icon :size="14">
							<Folder />
						</el-icon>
						<span>子组 ({{ groups.length }})</span>
					</div>
					<div class="doc-panel__grid">
						<article
v-for="group in groups" :key="group.id" class="doc-panel__card"
							@click="$emit('group-click', group)">
							<div class="doc-panel__card-head">
								<el-icon :size="16" class="doc-panel__card-icon">
									<Folder />
								</el-icon>
								<h5 class="doc-panel__card-name">{{ group.name }}</h5>
							</div>
							<p v-if="group.desc || group.description" class="doc-panel__card-desc">
								{{ group.desc || group.description }}
							</p>
							<div class="doc-panel__card-footer">
								<span v-if="group.owner || group.ownerName" class="doc-panel__card-meta">
									<el-icon :size="12">
										<User />
									</el-icon>
									{{ group.owner || group.ownerName }}
								</span>
								<span class="doc-panel__card-meta">
									<el-icon :size="12">
										<Document />
									</el-icon>
									{{ group.fileCount ?? 0 }} 个文件
								</span>
							</div>
						</article>
					</div>
				</template>
			</div>
		</div>
	</el-scrollbar>
</template>

<script setup lang="ts">
import {
	FolderOpened,
	Folder,
	OfficeBuilding,
	Box,
	User,
	Document,
	Clock,
	Right,
	Plus,
	Setting,
} from '@element-plus/icons-vue'
import { formatTime } from '~/utils/format'

export interface BreadcrumbItem {
	label: string
	clickable?: boolean
	type?: string
	id?: number | string
}

defineProps<{
	type: 'empty' | 'category' | 'department' | 'productline' | 'group'
	data?: any
	groups?: any[]
	breadcrumb?: BreadcrumbItem[]
}>()

defineEmits<{
	'group-click': [group: any]
	'create-group': []
	'create-product-line': []
	'admin-settings': []
	'manage-entity': []
	'group-settings': []
	'breadcrumb-click': [item: BreadcrumbItem]
}>()
</script>

<style lang="scss" scoped>
.doc-panel {
	height: 100%;
}

// ── Empty state ──
.doc-panel__empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 14px;
	height: 100%;
	min-height: 400px;
}

.doc-panel__empty-text {
	font-size: 14px;
	color: var(--df-subtext);
	margin: 0;
}

// ── Section wrapper ──
.doc-panel__section {
	padding: 24px;
}

// ── Header ──
.doc-panel__header {
	display: flex;
	align-items: flex-start;
	gap: 14px;
	margin-bottom: 20px;
}

.doc-panel__header-icon {
	width: 44px;
	height: 44px;
	border-radius: 10px;
	background: var(--df-primary-soft);
	color: var(--df-primary);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;

	&--group {
		background: color-mix(in srgb, #f59e0b 12%, transparent);
		color: #f59e0b;
	}
}

.doc-panel__header-info {
	flex: 1;
	min-width: 0;
}

.doc-panel__title {
	font-size: 18px;
	font-weight: 700;
	color: var(--df-text);
	margin: 0 0 4px;
	line-height: 1.4;
}

.doc-panel__desc {
	font-size: 13px;
	color: var(--df-subtext);
	margin: 0 0 6px;
	line-height: 1.5;
}

.doc-panel__meta-row {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 4px;
}

.doc-panel__title-row {
	display: flex;
	align-items: center;
	gap: 10px;

	h3 {
		margin: 0;
	}
}

// ── Breadcrumb ──
.doc-panel__breadcrumb {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	color: var(--df-subtext);
	margin-bottom: 12px;
}

.doc-panel__breadcrumb-sep {
	color: var(--df-border);
}

.doc-panel__breadcrumb-link {
	color: var(--df-primary);
	cursor: pointer;
	transition: opacity 0.15s;

	&:hover {
		opacity: 0.8;
	}
}

.doc-panel__breadcrumb-current {
	color: var(--df-text);
}

// ── Action bar (操作按钮栏) ──
.doc-panel__action-bar {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 16px;
}

// ── Grid label ──
.doc-panel__grid-label {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	font-weight: 600;
	color: var(--df-subtext);
	margin-bottom: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--df-border);

	.el-icon {
		color: #f59e0b;
	}
}

// ── Cards grid ──
.doc-panel__grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
	gap: 12px;
}

.doc-panel__card {
	padding: 14px 16px;
	background: var(--df-surface);
	border: 1px solid var(--df-border);
	border-radius: 10px;
	cursor: pointer;
	transition:
		border-color 0.2s,
		box-shadow 0.2s,
		transform 0.15s;

	&:hover {
		border-color: var(--df-primary);
		box-shadow: 0 2px 12px rgb(0 0 0 / 0.06);
		transform: translateY(-1px);
	}
}

.doc-panel__card-head {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 6px;
}

.doc-panel__card-icon {
	color: #f59e0b;
	flex-shrink: 0;
}

.doc-panel__card-name {
	font-size: 14px;
	font-weight: 600;
	color: var(--df-text);
	margin: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.doc-panel__card-desc {
	font-size: 12px;
	color: var(--df-subtext);
	margin: 0 0 10px;
	line-height: 1.5;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.doc-panel__card-footer {
	display: flex;
	align-items: center;
	gap: 14px;
}

.doc-panel__card-meta {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	font-size: 12px;
	color: var(--df-subtext);

	.el-icon {
		opacity: 0.6;
	}
}

// ── No groups ──
.doc-panel__no-groups {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
	padding: 48px 24px;
	text-align: center;

	p {
		font-size: 13px;
		color: var(--df-subtext);
		margin: 0;
	}
}

// ── Group detail meta ──
.doc-panel__meta {
	display: flex;
	flex-wrap: wrap;
	gap: 20px;
	padding: 16px 18px;
	background: var(--df-surface);
	border: 1px solid var(--df-border);
	border-radius: 10px;
	margin-bottom: 20px;
}

.doc-panel__meta-item {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;

	.el-icon {
		color: var(--df-subtext);
		opacity: 0.6;
	}
}

.doc-panel__meta-label {
	color: var(--df-subtext);

	&::after {
		content: ':';
		margin-right: 2px;
	}
}

.doc-panel__meta-value {
	color: var(--df-text);
	font-weight: 500;
}

// ── Enter repo button ──
.doc-panel__actions {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 4px;
}

.doc-panel__enter-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 32px;
	padding: 0 15px;
	font-size: 14px;
	font-weight: 500;
	color: #fff;
	background: var(--df-primary);
	border-radius: 4px;
	text-decoration: none;
	transition:
		background 0.2s,
		box-shadow 0.2s;

	&:hover {
		background: var(--df-primary-hover);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--df-primary) 30%, transparent);
	}

	.el-icon {
		transition: transform 0.2s;
	}

	&:hover .el-icon {
		transform: translateX(2px);
	}
}
</style>
