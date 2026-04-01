<template>
	<section class="pf-page-stack">
		<PageTitle title="共享文档" subtitle="组织树、仓库卡片、快速入口" />

		<section class="doc-explorer">
			<!-- Left tree panel -->
			<div class="doc-explorer__tree" :style="{ width: `${treePanelWidth}px` }">
				<div class="doc-explorer__tree-header">
					<el-icon :size="14">
						<Collection />
					</el-icon>
					<span>文档导航</span>
				</div>
				<DocNavTree
v-model="selectedGroupId" :categories="treeCategories" mode="nav" @group-select="onGroupSelect"
					@category-select="onCategorySelect" @group-create="onGroupCreate" @group-more="onGroupMore" />
			</div>

			<!-- Resizer -->
			<div class="doc-explorer__resizer" @mousedown="startResize" />

			<!-- Right content panel -->
			<div class="doc-explorer__content">
				<div class="doc-explorer__content-header">
					<h4>{{ selectedGroupName || '请在左侧选择目标组' }}</h4>
					<NuxtLink v-if="selectedGroupId" class="pf-btn" :to="`/docs/repo/${selectedGroupId}`">
						进入仓库
					</NuxtLink>
				</div>

				<div v-if="!selectedGroupId" class="doc-explorer__empty">
					<el-icon :size="48" color="var(--df-subtext)" style="opacity: 0.3">
						<FolderOpened />
					</el-icon>
					<p>请在左侧选择目标组</p>
				</div>

				<div v-else class="doc-explorer__cards">
					<article v-for="repo in filteredRepos" :key="repo.id" class="doc-explorer__card">
						<h5>{{ repo.name }}</h5>
						<p>{{ repo.description }}</p>
						<NuxtLink :to="`/docs/repo/${repo.id}`">查看详情</NuxtLink>
					</article>
				</div>
			</div>
		</section>
	</section>
</template>

<script setup lang="ts">
import { FolderOpened, Collection } from '@element-plus/icons-vue'
import type { NavTreeCategory, NavTreeGroup, NavTreeFile } from '~/types/doc-nav-tree'

definePageMeta({ layout: 'prototype' })
useHead({ title: '共享文档 - DocFlow' })

// ── Tree panel resize ──
const treePanelWidth = ref(260)
function startResize(e: MouseEvent) {
	const startX = e.clientX
	const startW = treePanelWidth.value
	const onMove = (ev: MouseEvent) => {
		treePanelWidth.value = Math.max(180, Math.min(600, startW + ev.clientX - startX))
	}
	const onUp = () => {
		document.removeEventListener('mousemove', onMove)
		document.removeEventListener('mouseup', onUp)
		document.body.style.cursor = ''
		document.body.style.userSelect = ''
	}
	document.body.style.cursor = 'col-resize'
	document.body.style.userSelect = 'none'
	document.addEventListener('mousemove', onMove)
	document.addEventListener('mouseup', onUp)
}

// ── Selection state ──
const selectedGroupId = ref<number | null>(null)
const selectedGroupName = ref('')

function onGroupSelect(group: NavTreeGroup, _file?: NavTreeFile) {
	selectedGroupName.value = group.name
}

function onCategorySelect(cat: NavTreeCategory) {
	selectedGroupId.value = null
	selectedGroupName.value = cat.label
}

function onGroupCreate(_group: NavTreeGroup) {
	// TODO: 打开创建子组弹窗
}

function onGroupMore(_ev: MouseEvent, _group: NavTreeGroup) {
	// TODO: 打开上下文菜单
}

// ── Mock data (后续替换为 API 调用) ──
const treeCategories = ref<NavTreeCategory[]>([
	{
		id: 'company',
		label: '公司层',
		scope: 'company',
		badge: 1,
		groups: [
			{
				id: 100,
				name: '设计规范组',
				fileCount: 1,
				files: [{ id: 1001, name: 'UI设计规范v2.pdf', type: 'pdf' }],
			},
		],
	},
	{
		id: 'department',
		label: '按部门',
		scope: 'department',
		badge: 3,
		orgUnits: [
			{
				id: 'dept_product',
				label: '产品部',
				badge: 4,
				groups: [
					{
						id: 201,
						name: '产品需求组',
						fileCount: 6,
						children: [],
						files: [
							{ id: 2001, name: 'DocFlow-产品需求文档.md', type: 'md' },
							{ id: 2002, name: '2026年Q1产品规划.pdf', type: 'pdf' },
							{ id: 2003, name: '数据看板设计稿.pdf', type: 'pdf' },
							{ id: 2004, name: 'API接口规范文档.md', type: 'md' },
							{ id: 2005, name: '用户增长策略分析.pdf', type: 'pdf' },
						],
					},
					{
						id: 202,
						name: '部门规章制度',
						fileCount: 2,
						files: [
							{ id: 2010, name: '产品部考勤管理规定.pdf', type: 'pdf' },
						],
					},
					{
						id: 203,
						name: '会议纪要',
						fileCount: 2,
						files: [
							{ id: 2020, name: '2026-03-14 产品评审.md', type: 'md' },
							{ id: 2021, name: '2026年2月月度总结.pdf', type: 'pdf' },
						],
					},
					{
						id: 204,
						name: '学习分享',
						fileCount: 3,
						children: [
							{
								id: 2041,
								name: '前端技术分享',
								fileCount: 1,
								files: [{ id: 2030, name: 'Vue3组合式API最佳实践.md', type: 'md' }],
							},
							{
								id: 2042,
								name: '设计心得',
								fileCount: 1,
								files: [{ id: 2031, name: '2026年UI趋势.pptx', type: 'pptx' }],
							},
						],
					},
				],
			},
			{
				id: 'dept_tech',
				label: '技术部',
				badge: 1,
				groups: [
					{ id: 301, name: '技术架构组', fileCount: 0 },
				],
			},
			{
				id: 'dept_ops',
				label: '运营部',
				badge: 1,
				groups: [
					{ id: 401, name: '运营组', fileCount: 0 },
				],
			},
		],
	},
	{
		id: 'productline',
		label: '按产品线',
		scope: 'productline',
		badge: 5,
		orgUnits: [
			{
				id: 'pl_global',
				label: '全球代理',
				badge: 1,
				groups: [
					{ id: 501, name: '全球代理需求组', fileCount: 0 },
				],
			},
		],
	},
])

// ── Right panel filtered repos (mock) ──
const allRepos = [
	{ id: 201, name: '产品需求组', description: '产品需求文档、PRD、设计稿集中管理' },
	{ id: 202, name: '部门规章制度', description: '部门内规章制度文档' },
	{ id: 203, name: '会议纪要', description: '周会、评审等会议纪要归档' },
	{ id: 204, name: '学习分享', description: '团队学习分享文档' },
]

const filteredRepos = computed(() => {
	if (!selectedGroupId.value) return []
	// 展示选中组的子组作为卡片
	return allRepos.filter((r) => r.id !== selectedGroupId.value)
})
</script>

<style lang="scss" scoped>
.doc-explorer {
	display: flex;
	gap: 0;
	min-height: 480px;
	height: calc(100vh - 200px);
	border: 1px solid var(--df-border);
	border-radius: 12px;
	background: var(--df-panel);
	overflow: hidden;
}

.doc-explorer__tree {
	flex-shrink: 0;
	border-right: 1px solid var(--df-border);
	background: var(--df-surface);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.doc-explorer__tree-header {
	padding: 14px 16px;
	font-size: 13px;
	font-weight: 600;
	color: var(--df-subtext);
	border-bottom: 1px solid var(--df-border);
	letter-spacing: 0.5px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	gap: 6px;

	.el-icon {
		color: var(--df-primary);
	}
}

.doc-explorer__resizer {
	width: 4px;
	cursor: col-resize;
	background: transparent;
	flex-shrink: 0;
	position: relative;
	z-index: 5;
	transition: background 0.15s;

	&:hover,
	&:active {
		background: var(--df-primary);
	}

	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: -3px;
		right: -3px;
		bottom: 0;
	}
}

.doc-explorer__content {
	flex: 1;
	padding: 20px;
	overflow-y: auto;
	min-width: 200px;
}

.doc-explorer__content-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16px;

	h4 {
		font-size: 15px;
		font-weight: 600;
		margin: 0;
	}
}

.doc-explorer__empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	height: 300px;

	p {
		font-size: 13px;
		color: var(--df-subtext);
		margin: 0;
	}
}

.doc-explorer__cards {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	gap: 14px;
}

.doc-explorer__card {
	padding: 16px 18px;
	background: var(--df-panel);
	border: 1px solid var(--df-border);
	border-radius: 10px;
	cursor: pointer;
	transition:
		border-color 0.2s,
		box-shadow 0.2s,
		transform 0.2s;

	&:hover {
		border-color: var(--df-primary);
		box-shadow: var(--df-shadow-md);
		transform: translateY(-1px);
	}

	h5 {
		font-size: 14px;
		font-weight: 600;
		margin: 0 0 4px;
	}

	p {
		font-size: 12px;
		color: var(--df-subtext);
		margin: 0 0 12px;
	}

	a {
		font-size: 12px;
		color: var(--df-primary);
	}
}
</style>
