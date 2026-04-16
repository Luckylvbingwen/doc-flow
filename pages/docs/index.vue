<template>
	<section v-loading.fullscreen.lock="pageLoading" class="pf-page-stack">
		<PageTitle title="共享文档" />

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
					@category-select="onCategorySelect" @org-select="onOrgSelect" @category-create="onCategoryCreate"
					@category-more="onCategoryMore" @org-create="onOrgCreate" @org-more="onOrgMore" @group-create="onGroupCreate"
					@group-more="onGroupMore" />
			</div>

			<!-- Resizer -->
			<div class="doc-explorer__resizer" @mousedown="startResize" />

			<!-- Right content panel -->
			<div class="doc-explorer__content">
				<DocExplorerPanel
:type="selectedType" :data="selectedData" :groups="selectedGroups"
					:breadcrumb="selectedBreadcrumb" @group-click="onPanelGroupClick" @create-group="onPanelCreateGroup"
					@create-product-line="onCreateProductLine" @admin-settings="onAdminSettings" @manage-entity="onManageEntity"
					@group-settings="onGroupSettings" @breadcrumb-click="onBreadcrumbClick" />
			</div>
		</section>

		<!-- Modals -->
		<GroupFormModal
v-model:visible="groupModalVisible" :mode="groupModalMode" :group="groupModalData"
			:location="groupModalLocation" :scope-type="groupModalScopeType" :scope-ref-id="groupModalScopeRefId"
			:parent-id="groupModalParentId" @success="refreshTree" />

		<ProductLineFormModal
v-model:visible="plModalVisible" :mode="plModalMode" :product-line="plModalData"
			@success="refreshTree" />

		<!-- Context menu -->
		<TreeActionMenu
ref="actionMenuRef" @edit-group="onEditGroup" @create-child="onCreateChild"
			@delete-group="onDeleteGroup" @create-group="onCreateGroupFromMenu" @edit-product-line="onEditProductLine"
			@delete-product-line="onDeleteProductLine" @create-product-line="onCreateProductLine"
			@admin-settings="onAdminSettings" />
	</section>
</template>

<script setup lang="ts">
import { Collection } from '@element-plus/icons-vue'
import type { NavTreeCategory, NavTreeGroup, NavTreeFile, NavTreeOrgUnit } from '~/types/doc-nav-tree'
import { apiGetGroupTree, apiGetGroup, apiDeleteGroup } from '~/api/groups'
import { apiDeleteProductLine } from '~/api/product-lines'

definePageMeta({ layout: 'prototype' })
useHead({ title: '共享文档 - DocFlow' })

// ── Page loading ──
const { pageLoading, run } = usePageLoading()

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

// ── Tree data ──
const treeCategories = ref<NavTreeCategory[]>([])

async function fetchTree() {
	const res = await apiGetGroupTree()
	if (res.success && res.data) {
		treeCategories.value = res.data
	}
}

async function refreshTree() {
	await fetchTree()
}

// ── Selection state ──
const selectedGroupId = ref<number | null>(null)
const selectedType = ref<'empty' | 'category' | 'department' | 'productline' | 'group'>('empty')
const selectedData = ref<any>(null)
const selectedGroups = ref<any[]>([])
const selectedBreadcrumb = ref<Array<{ label: string; clickable?: boolean; type?: string; id?: number | string }>>([])

// ── Tree events: category / group select ──
function onCategorySelect(cat: NavTreeCategory) {
	selectedGroupId.value = null
	selectedType.value = 'category'
	selectedData.value = cat
	selectedBreadcrumb.value = []
	if (cat.groups?.length) {
		selectedGroups.value = cat.groups
	} else if (cat.orgUnits?.length) {
		selectedGroups.value = cat.orgUnits.flatMap((org) => org.groups)
	} else {
		selectedGroups.value = []
	}
}

function onOrgSelect(cat: NavTreeCategory, org: NavTreeOrgUnit) {
	selectedGroupId.value = null
	const scope = cat.scope
	selectedType.value = scope === 'department' ? 'department' : 'productline'
	selectedData.value = { ...org, scope }
	selectedBreadcrumb.value = []
	selectedGroups.value = org.groups ?? []
}

async function onGroupSelect(group: NavTreeGroup, _file?: NavTreeFile) {
	selectedGroupId.value = group.id
	selectedType.value = 'group'
	// 构建面包屑
	selectedBreadcrumb.value = buildBreadcrumb(group)
	// Fetch full group detail from API
	try {
		const res = await apiGetGroup(group.id)
		if (res.success && res.data) {
			selectedData.value = res.data
		} else {
			selectedData.value = group
		}
	} catch {
		selectedData.value = group
	}
	selectedGroups.value = group.children ?? []
}

function onPanelGroupClick(group: any) {
	if (group?.id) {
		selectedGroupId.value = group.id
		onGroupSelect(group as NavTreeGroup)
	}
}

// ── GroupFormModal state ──
const groupModalVisible = ref(false)
const groupModalMode = ref<'create' | 'edit'>('create')
const groupModalData = ref<{ id: number; name: string; description: string | null } | undefined>()
const groupModalLocation = ref<string | undefined>()
const groupModalScopeType = ref<number | undefined>()
const groupModalScopeRefId = ref<number | undefined>()
const groupModalParentId = ref<number | undefined>()

function openGroupCreateModal(options: {
	location: string
	scopeType: number
	scopeRefId?: number | null
	parentId?: number | null
}) {
	groupModalMode.value = 'create'
	groupModalData.value = undefined
	groupModalLocation.value = options.location
	groupModalScopeType.value = options.scopeType
	groupModalScopeRefId.value = options.scopeRefId ?? undefined
	groupModalParentId.value = options.parentId ?? undefined
	groupModalVisible.value = true
}

function openGroupEditModal(group: NavTreeGroup) {
	groupModalMode.value = 'edit'
	groupModalData.value = {
		id: group.id,
		name: group.name,
		description: group.desc ?? null,
	}
	groupModalLocation.value = undefined
	groupModalScopeType.value = undefined
	groupModalScopeRefId.value = undefined
	groupModalParentId.value = undefined
	groupModalVisible.value = true
}

// ── ProductLineFormModal state ──
const plModalVisible = ref(false)
const plModalMode = ref<'create' | 'edit'>('create')
const plModalData = ref<{ id: number; name: string; description: string | null } | undefined>()

// ── TreeActionMenu ref ──
const actionMenuRef = ref<{ open: (event: MouseEvent, nodeType: string, nodeData: any, category?: NavTreeCategory | null) => void; close: () => void } | null>(null)

// ── Tree events: category-create / org-create / group-create ──
function onCategoryCreate(cat: NavTreeCategory) {
	if (cat.scope === 'company') {
		// Create group under company scope
		openGroupCreateModal({
			location: '公司层',
			scopeType: 1,
		})
	} else if (cat.scope === 'productline') {
		// Create a new product line
		plModalMode.value = 'create'
		plModalData.value = undefined
		plModalVisible.value = true
	}
	// Department category: create is not supported from the + button (departments come from external system)
}

function onOrgCreate(cat: NavTreeCategory, org: NavTreeOrgUnit) {
	const scopeType = cat.scope === 'department' ? 2 : 3
	const scopeRefId = parseOrgId(org.id)
	const location = cat.scope === 'department'
		? `按部门 / ${org.label}`
		: `按产品线 / ${org.label}`
	openGroupCreateModal({ location, scopeType, scopeRefId })
}

function onGroupCreate(group: NavTreeGroup) {
	// Create child group under an existing group
	const location = buildGroupLocation(group)
	openGroupCreateModal({
		location,
		scopeType: group.scopeType ?? 1,
		scopeRefId: group.scopeRefId ?? undefined,
		parentId: group.id,
	})
}

// ── Tree events: more menus (context menus) ──
function onCategoryMore(ev: MouseEvent, cat: NavTreeCategory) {
	actionMenuRef.value?.open(ev, 'category', cat, cat)
}

function onOrgMore(ev: MouseEvent, cat: NavTreeCategory, org: NavTreeOrgUnit) {
	actionMenuRef.value?.open(ev, 'org', org, cat)
}

function onGroupMore(ev: MouseEvent, group: NavTreeGroup) {
	actionMenuRef.value?.open(ev, 'group', group)
}

// ── TreeActionMenu events ──
function onEditGroup(group: NavTreeGroup) {
	openGroupEditModal(group)
}

function onCreateChild(parentGroup: NavTreeGroup) {
	const location = buildGroupLocation(parentGroup)
	openGroupCreateModal({
		location,
		scopeType: parentGroup.scopeType ?? 1,
		scopeRefId: parentGroup.scopeRefId ?? undefined,
		parentId: parentGroup.id,
	})
}

async function onDeleteGroup(group: NavTreeGroup) {
	const confirmed = await msgConfirm(`确定要删除组「${group.name}」吗？删除后不可恢复。`, '删除组', { danger: true })
	if (!confirmed) return

	try {
		const res = await apiDeleteGroup(group.id)
		if (res.success) {
			msgSuccess(res.message || '删除成功')
			// Reset selection if the deleted group was selected
			if (selectedGroupId.value === group.id) {
				selectedType.value = 'empty'
				selectedData.value = null
				selectedGroups.value = []
				selectedGroupId.value = null
			}
			await refreshTree()
		} else {
			msgError(res.message || '删除失败')
		}
	} catch {
		msgError('删除失败')
	}
}

function onCreateGroupFromMenu(scopeInfo: { scopeType: number; scopeRefId?: number | null; parentId?: number | null }) {
	const locationLabel = scopeInfo.scopeType === 1
		? '公司层'
		: scopeInfo.scopeType === 2
			? '按部门'
			: '按产品线'
	openGroupCreateModal({
		location: locationLabel,
		scopeType: scopeInfo.scopeType,
		scopeRefId: scopeInfo.scopeRefId ?? undefined,
		parentId: scopeInfo.parentId ?? undefined,
	})
}

function onEditProductLine(pl: NavTreeOrgUnit) {
	plModalMode.value = 'edit'
	plModalData.value = {
		id: parseOrgId(pl.id),
		name: pl.label,
		description: null,
	}
	plModalVisible.value = true
}

async function onDeleteProductLine(pl: NavTreeOrgUnit) {
	const confirmed = await msgConfirm(`确定要删除产品线「${pl.label}」吗？删除后不可恢复。`, '删除产品线', { danger: true })
	if (!confirmed) return

	try {
		const res = await apiDeleteProductLine(parseOrgId(pl.id))
		if (res.success) {
			msgSuccess(res.message || '删除成功')
			await refreshTree()
		} else {
			msgError(res.message || '删除失败')
		}
	} catch {
		msgError('删除失败')
	}
}

function onCreateProductLine() {
	plModalMode.value = 'create'
	plModalData.value = undefined
	plModalVisible.value = true
}

function onAdminSettings() {
	// TODO: 管理员设置功能（后续迭代实现）
	msgWarning('管理员设置功能即将上线')
}

function onManageEntity() {
	// TODO: 部门管理/产品线管理功能（后续迭代实现）
	msgWarning('管理功能即将上线')
}

function onGroupSettings() {
	// TODO: 组设置功能（后续迭代实现）
	msgWarning('组设置功能即将上线')
}

/** 右侧面板中的「创建组/创建子组」按钮 */
function onPanelCreateGroup() {
	if (selectedType.value === 'group' && selectedData.value) {
		// 组详情页 → 创建子组
		onGroupCreate(selectedData.value as NavTreeGroup)
	} else if (selectedType.value === 'category') {
		// 公司层 → 创建组
		onCategoryCreate(selectedData.value as NavTreeCategory)
	} else if (selectedType.value === 'department' || selectedType.value === 'productline') {
		// 部门/产品线 → 创建组
		const data = selectedData.value
		const scopeType = selectedType.value === 'department' ? 2 : 3
		const orgId = typeof data?.id === 'string' ? parseInt(data.id.replace(/\D/g, '')) : data?.id
		const location = selectedType.value === 'department'
			? `按部门 / ${data?.label || data?.name}`
			: `按产品线 / ${data?.label || data?.name}`
		openGroupCreateModal({ location, scopeType, scopeRefId: orgId })
	}
}

// ── Helpers ──
function parseOrgId(id: string | number): number {
	if (typeof id === 'number') return id
	return parseInt(id.replace(/\D/g, '')) || 0
}

function buildGroupLocation(group: NavTreeGroup): string {
	// Build a human-readable location path for the group
	// Find which category / org this group belongs to by searching the tree
	for (const cat of treeCategories.value) {
		// Check company direct groups
		if (cat.groups) {
			const found = findGroupInList(cat.groups, group.id)
			if (found) return `${cat.label} / ${found.path}`
		}
		// Check org unit groups
		if (cat.orgUnits) {
			for (const org of cat.orgUnits) {
				const found = findGroupInList(org.groups, group.id)
				if (found) return `${cat.label} / ${org.label} / ${found.path}`
			}
		}
	}
	return group.name
}

function findGroupInList(groups: NavTreeGroup[], targetId: number): { path: string } | null {
	for (const g of groups) {
		if (g.id === targetId) return { path: g.name }
		if (g.children) {
			const found = findGroupInList(g.children, targetId)
			if (found) return { path: `${g.name} / ${found.path}` }
		}
	}
	return null
}

/** 构建面包屑：scope前缀 / orgUnit / 父组链 / 当前组 */
function buildBreadcrumb(group: NavTreeGroup) {
	const crumbs: Array<{ label: string; clickable?: boolean; type?: string; id?: number | string }> = []

	for (const cat of treeCategories.value) {
		if (cat.groups) {
			const chain = findGroupChain(cat.groups, group.id)
			if (chain) {
				crumbs.push({ label: cat.label, clickable: true, type: 'category', id: cat.id })
				chain.forEach((g, i) => {
					crumbs.push({ label: g.name, clickable: i < chain.length - 1, type: 'group', id: g.id })
				})
				return crumbs
			}
		}
		if (cat.orgUnits) {
			for (const org of cat.orgUnits) {
				const chain = findGroupChain(org.groups, group.id)
				if (chain) {
					crumbs.push({ label: cat.label, clickable: true, type: 'category', id: cat.id })
					crumbs.push({ label: org.label, clickable: true, type: 'org', id: org.id })
					chain.forEach((g, i) => {
						crumbs.push({ label: g.name, clickable: i < chain.length - 1, type: 'group', id: g.id })
					})
					return crumbs
				}
			}
		}
	}
	return crumbs
}

/** 在组树中找到目标组的祖先链（含自身） */
function findGroupChain(groups: NavTreeGroup[], targetId: number): NavTreeGroup[] | null {
	for (const g of groups) {
		if (g.id === targetId) return [g]
		if (g.children) {
			const chain = findGroupChain(g.children, targetId)
			if (chain) return [g, ...chain]
		}
	}
	return null
}

function onBreadcrumbClick(item: { label: string; type?: string; id?: number | string }) {
	if (item.type === 'category') {
		const cat = treeCategories.value.find(c => c.id === item.id)
		if (cat) onCategorySelect(cat)
	} else if (item.type === 'org') {
		// 找到对应的 orgUnit 和 category
		for (const cat of treeCategories.value) {
			const org = cat.orgUnits?.find(o => o.id === item.id)
			if (org) {
				onOrgSelect(cat, org)
				break
			}
		}
	} else if (item.type === 'group' && typeof item.id === 'number') {
		// 从树中找到组节点
		for (const cat of treeCategories.value) {
			const allGroups = [
				...(cat.groups ?? []),
				...(cat.orgUnits?.flatMap(o => o.groups) ?? []),
			]
			const found = findGroupById(allGroups, item.id)
			if (found) {
				onGroupSelect(found)
				break
			}
		}
	}
}

function findGroupById(groups: NavTreeGroup[], id: number): NavTreeGroup | null {
	for (const g of groups) {
		if (g.id === id) return g
		if (g.children) {
			const found = findGroupById(g.children, id)
			if (found) return found
		}
	}
	return null
}

// ── Init ──
onMounted(() => {
	run(() => fetchTree())
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
	min-width: 200px;
	overflow: hidden;
}
</style>
