<template>
	<Teleport to="body">
		<!-- Backdrop overlay -->
		<div v-if="visible" class="tree-action-menu__overlay" @click="close" @contextmenu.prevent="close" />

		<!-- Menu panel -->
		<Transition name="tree-menu-fade">
			<div v-if="visible" ref="menuRef" class="tree-action-menu" :style="{ top: `${pos.y}px`, left: `${pos.x}px` }">
				<button
v-for="item in menuItems" :key="item.key" class="tree-action-menu__item"
					:class="{ 'is-danger': item.danger }" @click="handleAction(item.key)">
					<el-icon :size="14">
						<component :is="item.icon" />
					</el-icon>
					<span>{{ item.label }}</span>
				</button>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import {
	Edit,
	Plus,
	Delete,
	FolderAdd,
} from '@element-plus/icons-vue'
import type { NavTreeCategory, NavTreeOrgUnit, NavTreeGroup } from '~/types/doc-nav-tree'

type NodeType = 'category' | 'org' | 'group'

interface MenuItem {
	key: string
	label: string
	icon: typeof Edit
	danger?: boolean
}

const emit = defineEmits<{
	'edit-group': [group: NavTreeGroup]
	'create-child': [parentGroup: NavTreeGroup]
	'delete-group': [group: NavTreeGroup]
	'create-group': [scopeInfo: { scopeType: number; scopeRefId?: number | null; parentId?: number | null }]
	'edit-product-line': [productLine: NavTreeOrgUnit]
	'delete-product-line': [productLine: NavTreeOrgUnit]
	'create-product-line': []
	'admin-settings': []
}>()

// ── State ──
const visible = ref(false)
const pos = reactive({ x: 0, y: 0 })
const menuRef = ref<HTMLElement>()

const currentNodeType = ref<NodeType>('group')
const currentNodeData = ref<any>(null)
const currentCategory = ref<NavTreeCategory | null>(null)

// ── Menu items (computed from current state) ──
const menuItems = computed<MenuItem[]>(() => {
	if (currentNodeType.value === 'group') {
		return [
			{ key: 'edit-group', label: '编辑组', icon: Edit },
			{ key: 'create-child', label: '创建子组', icon: FolderAdd },
			{ key: 'delete-group', label: '删除组', icon: Delete, danger: true },
		]
	}

	if (currentNodeType.value === 'org') {
		const scope = currentCategory.value?.scope
		if (scope === 'department') {
			// 部门只能创建组，不能编辑/删除
			return [
				{ key: 'create-group-under-org', label: '创建组', icon: Plus },
			]
		}
		// 产品线：可编辑、可创建组、可删除
		return [
			{ key: 'edit-product-line', label: '编辑产品线', icon: Edit },
			{ key: 'create-group-under-org', label: '创建组', icon: Plus },
			{ key: 'delete-product-line', label: '删除产品线', icon: Delete, danger: true },
		]
	}

	if (currentNodeType.value === 'category') {
		const scope = currentCategory.value?.scope
		if (scope === 'company') {
			// 示例中公司层...菜单仅显示「管理员设置」
			return [
				{ key: 'admin-settings', label: '管理员设置', icon: Edit },
			]
		}
		// 按部门/按产品线分类不显示...菜单（由树组件控制），此处兜底返回空
		return []
	}

	return []
})

// ── Open method ──
function open(
	event: MouseEvent,
	nodeType: NodeType,
	nodeData: any,
	category?: NavTreeCategory | null,
) {
	currentNodeType.value = nodeType
	currentNodeData.value = nodeData
	currentCategory.value = category ?? null

	// 计算位置，确保不超出视口
	const vw = window.innerWidth
	const vh = window.innerHeight
	const menuW = 160
	const menuH = menuItems.value.length * 36 + 8

	pos.x = event.clientX + menuW > vw ? event.clientX - menuW : event.clientX
	pos.y = event.clientY + menuH > vh ? event.clientY - menuH : event.clientY

	visible.value = true
}

function close() {
	visible.value = false
}

// ── Action handler ──
function handleAction(key: string) {
	close()

	switch (key) {
		case 'edit-group':
			emit('edit-group', currentNodeData.value as NavTreeGroup)
			break
		case 'create-child':
			emit('create-child', currentNodeData.value as NavTreeGroup)
			break
		case 'delete-group':
			emit('delete-group', currentNodeData.value as NavTreeGroup)
			break
		case 'create-group-under-org': {
			const org = currentNodeData.value as NavTreeOrgUnit
			const scope = currentCategory.value?.scope
			emit('create-group', {
				scopeType: scope === 'department' ? 2 : 3,
				scopeRefId: typeof org.id === 'string' ? parseInt(org.id.replace(/\D/g, '')) : org.id,
			})
			break
		}
		case 'admin-settings':
			emit('admin-settings')
			break
		case 'edit-product-line':
			emit('edit-product-line', currentNodeData.value as NavTreeOrgUnit)
			break
		case 'delete-product-line':
			emit('delete-product-line', currentNodeData.value as NavTreeOrgUnit)
			break
		case 'create-product-line':
			emit('create-product-line')
			break
	}
}

// ── Keyboard escape ──
function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') close()
}

watch(visible, (val) => {
	if (val) {
		document.addEventListener('keydown', onKeydown)
	} else {
		document.removeEventListener('keydown', onKeydown)
	}
})

onUnmounted(() => {
	document.removeEventListener('keydown', onKeydown)
})

defineExpose({ open, close })
</script>

<style lang="scss" scoped>
.tree-action-menu__overlay {
	position: fixed;
	inset: 0;
	z-index: 2000;
}

.tree-action-menu {
	position: fixed;
	z-index: 2001;
	min-width: 150px;
	padding: 4px 0;
	background: var(--df-panel);
	border: 1px solid var(--df-border);
	border-radius: 8px;
	box-shadow:
		0 4px 16px rgb(0 0 0 / 0.08),
		0 1px 4px rgb(0 0 0 / 0.04);
}

.tree-action-menu__item {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 8px 14px;
	border: none;
	background: none;
	font-size: 13px;
	color: var(--df-text);
	cursor: pointer;
	transition: background 0.15s;
	outline: none;
	text-align: left;
	line-height: 1.4;

	.el-icon {
		color: var(--df-subtext);
		flex-shrink: 0;
		transition: color 0.15s;
	}

	&:hover {
		background: color-mix(in srgb, var(--df-primary) 8%, transparent);

		.el-icon {
			color: var(--df-primary);
		}
	}

	&.is-danger {
		color: var(--el-color-danger);

		.el-icon {
			color: var(--el-color-danger);
		}

		&:hover {
			background: color-mix(in srgb, var(--el-color-danger) 8%, transparent);
		}
	}
}

// ── Transition ──
.tree-menu-fade-enter-active {
	transition: opacity 0.15s, transform 0.15s;
}

.tree-menu-fade-leave-active {
	transition: opacity 0.1s, transform 0.1s;
}

.tree-menu-fade-enter-from {
	opacity: 0;
	transform: scale(0.95);
}

.tree-menu-fade-leave-to {
	opacity: 0;
	transform: scale(0.95);
}
</style>
