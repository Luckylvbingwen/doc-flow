<template>
	<div class="dn-tree" :class="`dn-tree--${mode}`">
		<!-- Search -->
		<div class="dn-search">
			<el-input
				v-model="keyword"
				:placeholder="mode === 'nav' ? '搜索组名称 / 文档名称...' : '搜索组名称...'"
				clearable
				:prefix-icon="Search"
				class="dn-search-input"
			/>
		</div>

		<!-- Tree body -->
		<el-scrollbar class="dn-body">
			<template v-for="cat in filteredCategories" :key="cat.id">
				<!-- Category header -->
				<div
					class="dn-node dn-category"
					:class="{ 'is-active': activeCategoryId === cat.id }"
					@click="handleCategoryClick(cat)"
				>
					<span
						class="dn-arrow"
						:class="{ 'is-collapsed': !expandedMap[cat.id] }"
						@click.stop="toggleExpand(cat.id)"
					>
						<el-icon :size="12"><ArrowDown /></el-icon>
					</span>
					<el-icon class="dn-icon" :size="14">
						<OfficeBuilding v-if="cat.scope === 'company'" />
						<Folder v-else-if="cat.scope === 'department'" />
						<Box v-else />
					</el-icon>
					<span class="dn-label">{{ cat.label }}</span>

					<span class="dn-right-zone">
						<span class="dn-badge">{{ cat.badge }}</span>
						<span v-if="mode === 'nav'" class="dn-hover-actions">
							<button
								class="dn-hover-btn"
								:title="getCategoryCreateLabel(cat.scope)"
								@click.stop="$emit('category-create', cat)"
							>
								<el-icon :size="13"><Plus /></el-icon>
							</button>
							<button
								v-if="cat.scope !== 'department' || true"
								class="dn-hover-btn"
								title="更多"
								@click.stop="$emit('category-more', $event, cat)"
							>
								<el-icon :size="13"><MoreFilled /></el-icon>
							</button>
						</span>
					</span>
				</div>

				<!-- Category children -->
				<div v-show="expandedMap[cat.id]" class="dn-children">
					<!-- Direct groups (company scope) -->
					<template v-if="cat.groups?.length">
						<DocNavTreeNode
							:groups="cat.groups"
							:depth="1"
							:mode="mode"
							:active-id="activeGroupId"
							:expanded-map="expandedMap"
							:search-keyword="keyword"
							:exclude-id="excludeId"
							@select="handleGroupSelect"
							@create="(g) => $emit('group-create', g)"
							@more="(ev, g) => $emit('group-more', ev, g)"
							@context-menu="(ev, g) => $emit('group-context-menu', ev, g)"
							@toggle="toggleExpand"
						/>
					</template>

					<!-- Org units (department / productline) -->
					<template v-if="cat.orgUnits?.length">
						<template v-for="org in cat.orgUnits" :key="org.id">
							<!-- Org unit node (部门名 / 产品线名) -->
							<div
								class="dn-node dn-org-unit"
								:style="{ paddingLeft: '32px' }"
								@click="handleOrgUnitClick(cat, org)"
							>
								<span
									class="dn-arrow"
									:class="{ 'is-collapsed': !expandedMap[org.id] }"
									@click.stop="toggleExpand(org.id)"
								>
									<el-icon :size="12"><ArrowDown /></el-icon>
								</span>
								<el-icon class="dn-icon" :size="14">
									<Folder v-if="cat.scope === 'department'" />
									<Box v-else />
								</el-icon>
								<span class="dn-label">{{ org.label }}</span>

								<span class="dn-right-zone">
									<span class="dn-badge">{{ org.badge }}</span>
									<span v-if="mode === 'nav'" class="dn-hover-actions">
										<button
											class="dn-hover-btn"
											title="新建组"
											@click.stop="$emit('org-create', cat, org)"
										>
											<el-icon :size="13"><Plus /></el-icon>
										</button>
										<button
											class="dn-hover-btn"
											title="更多"
											@click.stop="$emit('org-more', $event, cat, org)"
										>
											<el-icon :size="13"><MoreFilled /></el-icon>
										</button>
									</span>
								</span>
							</div>

							<!-- Org unit groups -->
							<div v-show="expandedMap[org.id]" class="dn-children">
								<DocNavTreeNode
									:groups="org.groups"
									:depth="2"
									:mode="mode"
									:active-id="activeGroupId"
									:expanded-map="expandedMap"
									:search-keyword="keyword"
									:exclude-id="excludeId"
									@select="handleGroupSelect"
									@create="(g) => $emit('group-create', g)"
									@more="(ev, g) => $emit('group-more', ev, g)"
									@context-menu="(ev, g) => $emit('group-context-menu', ev, g)"
									@toggle="toggleExpand"
								/>
							</div>
						</template>
					</template>
				</div>
			</template>

			<!-- Empty state -->
			<div v-if="keyword && filteredCategories.length === 0" class="dn-empty">
				<el-icon :size="32" color="var(--df-subtext)" style="opacity: 0.4"><Search /></el-icon>
				<p>未找到匹配结果</p>
			</div>
		</el-scrollbar>
	</div>
</template>

<script setup lang="ts">
import {
	ArrowDown,
	Folder,
	OfficeBuilding,
	Box,
	Plus,
	MoreFilled,
	Search,
} from '@element-plus/icons-vue'
import type {
	NavTreeCategory,
	NavTreeOrgUnit,
	NavTreeGroup,
	NavTreeFile,
	NavTreeMode,
} from '~/types/doc-nav-tree'

const props = withDefaults(
	defineProps<{
		/** 树分类数据 */
		categories: NavTreeCategory[]
		/** 模式: nav 完整导航 / picker 选择器 */
		mode?: NavTreeMode
		/** 当前选中的组 ID（双向绑定） */
		modelValue?: number | null
		/** picker 模式排除的组 ID（跨组移动时排除自身） */
		excludeId?: number | null
	}>(),
	{
		mode: 'nav',
		modelValue: null,
		excludeId: null,
	},
)

const emit = defineEmits<{
	'update:modelValue': [id: number | null]
	/** 组被选中 */
	'group-select': [group: NavTreeGroup, file?: NavTreeFile]
	/** 分类被点击 */
	'category-select': [category: NavTreeCategory]
	/** 分类 + 按钮 */
	'category-create': [category: NavTreeCategory]
	'category-more': [event: MouseEvent, category: NavTreeCategory]
	/** 组织单元（部门/产品线） */
	'org-create': [category: NavTreeCategory, org: NavTreeOrgUnit]
	'org-more': [event: MouseEvent, category: NavTreeCategory, org: NavTreeOrgUnit]
	/** 组操作 */
	'group-create': [group: NavTreeGroup]
	'group-more': [event: MouseEvent, group: NavTreeGroup]
	'group-context-menu': [event: MouseEvent, group: NavTreeGroup]
}>()

// ── Search ──
const keyword = ref('')

// ── Active state ──
const activeCategoryId = ref<string | null>(null)
const activeGroupId = computed(() => props.modelValue)

// ── Expand state ──
const expandedMap = reactive<Record<string | number, boolean>>({})

// 默认展开所有分类
onMounted(() => {
	expandAll()
	// 默认激活第一个分类
	if (props.categories.length > 0) {
		activeCategoryId.value = props.categories[0].id
	}
})

// ── Filtering ──
function matchKeyword(name: string): boolean {
	if (!keyword.value) return true
	return name.toLowerCase().includes(keyword.value.toLowerCase())
}

function filterGroupsRecursive(groups: NavTreeGroup[]): NavTreeGroup[] {
	if (!keyword.value) return groups
	return groups.reduce<NavTreeGroup[]>((acc, g) => {
		const childMatches = g.children ? filterGroupsRecursive(g.children) : []
		const fileMatches =
			props.mode === 'nav'
				? (g.files?.filter((f) => matchKeyword(f.name)) ?? [])
				: []
		if (matchKeyword(g.name) || childMatches.length > 0 || fileMatches.length > 0) {
			acc.push({
				...g,
				children: childMatches.length > 0 ? childMatches : g.children,
				files: fileMatches.length > 0 ? fileMatches : g.files,
			})
		}
		return acc
	}, [])
}

const filteredCategories = computed<NavTreeCategory[]>(() => {
	return props.categories
		.map((cat) => {
			const filteredGroups = cat.groups ? filterGroupsRecursive(cat.groups) : undefined
			const filteredOrgs = cat.orgUnits
				?.map((org) => ({
					...org,
					groups: filterGroupsRecursive(org.groups),
				}))
				.filter((org) => org.groups.length > 0 || matchKeyword(org.label))

			const hasContent =
				(filteredGroups && filteredGroups.length > 0) ||
				(filteredOrgs && filteredOrgs.length > 0)

			if (!keyword.value || hasContent || matchKeyword(cat.label)) {
				return { ...cat, groups: filteredGroups, orgUnits: filteredOrgs }
			}
			return null
		})
		.filter(Boolean) as NavTreeCategory[]
})

// 搜索时自动展开所有节点
watch(keyword, (val) => {
	if (val) {
		expandAll()
	}
})

function expandAll() {
	props.categories.forEach((cat) => {
		expandedMap[cat.id] = true
		cat.orgUnits?.forEach((org) => {
			expandedMap[org.id] = true
		})
		function expandGroups(groups?: NavTreeGroup[]) {
			groups?.forEach((g) => {
				expandedMap[g.id] = true
				expandGroups(g.children)
			})
		}
		expandGroups(cat.groups)
		cat.orgUnits?.forEach((org) => expandGroups(org.groups))
	})
}

// ── Interaction ──
function toggleExpand(id: string | number) {
	expandedMap[id] = !expandedMap[id]
}

function handleCategoryClick(cat: NavTreeCategory) {
	activeCategoryId.value = cat.id
	emit('category-select', cat)
}

function handleOrgUnitClick(cat: NavTreeCategory, org: NavTreeOrgUnit) {
	toggleExpand(org.id)
}

function handleGroupSelect(group: NavTreeGroup, file?: NavTreeFile) {
	emit('update:modelValue', group.id)
	emit('group-select', group, file)
}

function getCategoryCreateLabel(scope: string) {
	if (scope === 'company') return '新建组'
	if (scope === 'department') return '新建部门'
	return '新建产品线'
}

// ── Public methods ──
defineExpose({
	expandAll,
	toggleExpand,
	keyword,
})
</script>

<style lang="scss" scoped>
/* ── Container ── */
.dn-tree {
	display: flex;
	flex-direction: column;
	height: 100%;
	background: var(--df-surface);
	overflow: hidden;
}

/* ── Search ── */
.dn-search {
	padding: 10px 12px;
	border-bottom: 1px solid var(--df-border);
	flex-shrink: 0;

	.dn-search-input {
		:deep(.el-input__wrapper) {
			background: var(--df-panel);
			box-shadow: none;
			border-radius: 6px;
			font-size: 12px;
			padding: 4px 8px;

			&:hover {
				box-shadow: 0 0 0 1px var(--df-border) inset;
			}

			&.is-focus {
				box-shadow: 0 0 0 1px var(--df-primary) inset;
			}
		}

		:deep(.el-input__inner) {
			font-size: 12px;
			height: 26px;
		}

		:deep(.el-input__prefix) {
			font-size: 14px;
			color: var(--df-subtext);
		}
	}
}

/* ── Scrollable body ── */
.dn-body {
	flex: 1;
	min-height: 0;
}

/* ── Category & org-unit nodes (rendered inside DocNavTree itself) ── */
.dn-node {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 12px;
	font-size: 13px;
	cursor: pointer;
	transition:
		background 0.15s,
		color 0.15s;
	border-left: 3px solid transparent;
	color: var(--df-subtext);
	user-select: none;

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
}

.dn-category {
	font-weight: 600;
	font-size: 13px;
	color: var(--df-text);
	padding: 10px 12px;
	border-bottom: 1px solid color-mix(in srgb, var(--df-border) 50%, transparent);
}

.dn-org-unit {
	color: var(--df-text);
	font-weight: 500;
}

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

.dn-icon {
	flex-shrink: 0;
	color: inherit;
}

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

	&:hover {
		background: var(--df-primary-soft);
		color: var(--df-primary);
	}
}

.dn-children {
	overflow: hidden;
}

/* ── Empty state ── */
.dn-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 48px 32px;
	text-align: center;

	p {
		font-size: 13px;
		color: var(--df-subtext);
		margin: 0;
	}
}

/* ── Picker mode ── */
.dn-tree--picker {
	.dn-category {
		border-bottom: none;
	}
}
</style>
