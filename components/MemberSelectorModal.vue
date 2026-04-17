<template>
	<el-dialog
class="df-modal df-member-selector-modal" :model-value="visible" title="选择成员" width="680px"
		:close-on-click-modal="false" destroy-on-close @close="close">
		<div v-loading="treeLoading" class="ms-body">
			<!-- 左栏：导航 + 列表 -->
			<div class="ms-left">
				<div class="ms-search">
					<el-input v-model="searchKeyword" placeholder="搜索用户" clearable size="default" :prefix-icon="Search" />
				</div>

				<!-- 面包屑 -->
				<div class="ms-breadcrumb">
					<span class="ms-breadcrumb__item ms-breadcrumb__link" @click="goBack">
						组织架构
					</span>
					<template v-if="currentDept">
						<span class="ms-breadcrumb__sep">&gt;</span>
						<span class="ms-breadcrumb__item">{{ currentDept.name }}</span>
					</template>
				</div>

				<el-scrollbar class="ms-list-scroll">
					<!-- 搜索模式：全局搜索结果 -->
					<template v-if="searchKeyword">
						<div
v-for="user in filteredSearchUsers" :key="user.id" class="ms-item"
							:class="{ 'ms-item--disabled': user.joined || isExcluded(user.id) }" @click="toggleUser(user)">
							<el-checkbox
:model-value="isSelected(user.id)" :disabled="user.joined || isExcluded(user.id)" @click.stop
								@change="toggleUser(user)" />
							<span class="ms-item__avatar ms-item__avatar--text">{{ user.name?.slice(0, 1) }}</span>
							<span class="ms-item__name">{{ user.name }}</span>
							<span v-if="user.joined" class="ms-item__tag">已加入</span>
						</div>
						<div v-if="filteredSearchUsers.length === 0" class="ms-empty">无匹配用户</div>
					</template>

					<!-- 部门列表模式 -->
					<template v-else-if="!currentDept">
						<div v-for="dept in departments" :key="dept.id" class="ms-item ms-item--dept" @click="enterDept(dept)">
							<el-icon :size="16">
								<OfficeBuilding />
							</el-icon>
							<span class="ms-item__name">{{ dept.name }}</span>
							<span class="ms-item__count">{{ dept.memberCount }}</span>
							<el-icon :size="12">
								<ArrowRight />
							</el-icon>
						</div>
						<div v-if="departments.length === 0" class="ms-empty">暂无部门数据</div>
					</template>

					<!-- 部门内成员模式 -->
					<template v-else>
						<div
v-for="user in filteredDeptMembers" :key="user.id" class="ms-item"
							:class="{ 'ms-item--disabled': user.joined || isExcluded(user.id) }" @click="toggleUser(user)">
							<el-checkbox
:model-value="isSelected(user.id)" :disabled="user.joined || isExcluded(user.id)" @click.stop
								@change="toggleUser(user)" />
							<span class="ms-item__avatar ms-item__avatar--text">{{ user.name?.slice(0, 1) }}</span>
							<span class="ms-item__name">{{ user.name }}</span>
							<span v-if="user.joined" class="ms-item__tag">已加入</span>
						</div>
						<div v-if="filteredDeptMembers.length === 0" class="ms-empty">该部门暂无成员</div>
					</template>
				</el-scrollbar>
			</div>

			<!-- 右栏：已选 -->
			<div class="ms-right">
				<div class="ms-right__title">已选：{{ selectedUsers.length }} 个</div>
				<el-scrollbar class="ms-right__list">
					<div v-for="user in selectedUsers" :key="user.id" class="ms-selected-item">
						<span>{{ user.name }}</span>
						<el-icon class="ms-selected-item__remove" @click="removeSelected(user.id)">
							<Close />
						</el-icon>
					</div>
					<div v-if="selectedUsers.length === 0" class="ms-empty">未选择任何成员</div>
				</el-scrollbar>
			</div>
		</div>

		<template #footer>
			<div class="ms-footer" :class="{ 'ms-footer--no-role': !showRoleSelector }">
				<div v-if="showRoleSelector" class="ms-footer__role">
					<span class="ms-footer__role-label">默认权限</span>
					<el-select v-model="selectedRole" size="default" style="width: 130px">
						<el-option :value="1" label="管理员" />
						<el-option :value="2" label="可编辑" />
						<el-option :value="3" label="上传下载" />
					</el-select>
				</div>
				<div class="ms-footer__actions">
					<el-button @click="close">取消</el-button>
					<el-button type="primary" :disabled="selectedUsers.length === 0" @click="handleConfirm">
						确认{{ selectedUsers.length > 0 ? `（${selectedUsers.length}）` : '' }}
					</el-button>
				</div>
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { OfficeBuilding, ArrowRight, Close, Search } from '@element-plus/icons-vue'
import type { DeptTreeNode, DeptTreeMember, SelectedUser } from '~/types/group-member'
import { apiGetUserTree } from '~/api/group-members'

const props = withDefaults(defineProps<{
	visible: boolean
	groupId?: number
	multiple?: boolean
	excludeUserIds?: number[]
	showRoleSelector?: boolean
}>(), {
	groupId: undefined,
	multiple: true,
	excludeUserIds: () => [],
	showRoleSelector: true,
})

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'confirm': [users: SelectedUser[], role: number]
}>()

const departments = ref<DeptTreeNode[]>([])
const currentDept = ref<DeptTreeNode | null>(null)
const searchKeyword = ref('')
const selectedUsers = ref<SelectedUser[]>([])
const selectedRole = ref<number>(3) // PRD §254 默认上传下载
const treeLoading = ref(false)

const allUsers = computed(() => {
	const users = new Map<number, DeptTreeMember>()
	for (const dept of departments.value) {
		for (const m of dept.members) {
			if (!users.has(m.id)) users.set(m.id, m)
		}
	}
	return Array.from(users.values())
})

const filteredSearchUsers = computed(() => {
	const kw = searchKeyword.value.trim().toLowerCase()
	if (!kw) return []
	return allUsers.value.filter(u => u.name.toLowerCase().includes(kw))
})

const filteredDeptMembers = computed(() => {
	return currentDept.value?.members || []
})

function isSelected(userId: number) {
	return selectedUsers.value.some(u => u.id === userId)
}

function isExcluded(userId: number) {
	return props.excludeUserIds.includes(userId)
}

function toggleUser(user: DeptTreeMember) {
	if (user.joined || isExcluded(user.id)) return

	if (isSelected(user.id)) {
		selectedUsers.value = selectedUsers.value.filter(u => u.id !== user.id)
	} else {
		if (!props.multiple) {
			selectedUsers.value = [{ id: user.id, name: user.name, avatar: user.avatar }]
		} else {
			selectedUsers.value.push({ id: user.id, name: user.name, avatar: user.avatar })
		}
	}
}

function removeSelected(userId: number) {
	selectedUsers.value = selectedUsers.value.filter(u => u.id !== userId)
}

function enterDept(dept: DeptTreeNode) {
	currentDept.value = dept
}

function goBack() {
	currentDept.value = null
}

function close() {
	emit('update:visible', false)
}

function handleConfirm() {
	emit('confirm', [...selectedUsers.value], selectedRole.value)
	close()
}

async function loadTree() {
	treeLoading.value = true
	try {
		const res = await apiGetUserTree(props.groupId)
		if (res.success) {
			departments.value = res.data.departments
		}
	} finally {
		treeLoading.value = false
	}
}

watch(() => props.visible, (val) => {
	if (val) {
		selectedUsers.value = []
		selectedRole.value = 3
		searchKeyword.value = ''
		currentDept.value = null
		loadTree()
	}
})
</script>
