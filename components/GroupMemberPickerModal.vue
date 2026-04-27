<template>
	<el-dialog
class="df-modal df-group-member-picker-modal" :model-value="visible" :title="title" width="540px"
		:close-on-click-modal="false" destroy-on-close @close="onClose">
		<div class="gp-body">
			<div class="gp-search">
				<el-input v-model="keyword" placeholder="搜索组成员姓名" clearable :prefix-icon="Search" />
			</div>

			<div class="gp-info">
				可选 {{ selectableCount }} 人，已选 <strong>{{ selectedIds.length }}</strong> 人
				<span v-if="hasGray">（已设置文档级权限或组负责人不可选）</span>
			</div>

			<el-scrollbar class="gp-list" :class="{ 'is-loading': loading }">
				<div v-if="loading" class="gp-loading">
					<el-icon class="is-loading">
						<Loading />
					</el-icon>
					<span>加载中...</span>
				</div>

				<template v-else>
					<div
v-for="m in filteredMembers" :key="m.userId" class="gp-item"
						:class="{ 'gp-item--disabled': isDisabled(m), 'gp-item--checked': selectedIds.includes(m.userId) }"
						@click="toggle(m)">
						<el-checkbox
:model-value="selectedIds.includes(m.userId)" :disabled="isDisabled(m)" @click.stop
							@change="toggle(m)" />
						<span class="gp-avatar">{{ m.name.slice(0, 1) }}</span>
						<span class="gp-name">{{ m.name }}</span>
						<span v-if="m.isOwner" class="gp-tag gp-tag--owner">组负责人</span>
						<span v-else-if="excludedSet.has(m.userId)" class="gp-tag gp-tag--exists">已设置</span>
					</div>
					<div v-if="filteredMembers.length === 0" class="gp-empty">
						<EmptyState preset="no-results" compact :image-size="80" />
					</div>
				</template>
			</el-scrollbar>
		</div>

		<template #footer>
			<el-button @click="onClose">取消</el-button>
			<el-button type="primary" :disabled="selectedIds.length === 0" @click="onConfirm">
				确认（{{ selectedIds.length }}）
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { Search, Loading } from '@element-plus/icons-vue'
import { apiGetGroupMembers } from '~/api/group-members'
import type { GroupMember } from '~/types/group-member'
import { PERMISSION_LEVEL } from '~/utils/permission-meta'

interface PickerMember {
	userId: number
	name: string
	avatar: string | null
	role: 1 | 2 | 3
	isOwner: boolean
}

const props = withDefaults(defineProps<{
	visible: boolean
	/** 组 ID（必填，从该组的成员里选） */
	groupId: number
	/** 已设置文档级权限的成员 ID 集合（灰显，不可再选） */
	excludedUserIds?: number[]
	/** 弹窗标题 */
	title?: string
}>(), {
	excludedUserIds: () => [],
	title: '选择组成员设置文档权限（仅限组成员）',
})

const emit = defineEmits<{
	'update:visible': [val: boolean]
	confirm: [members: Array<{ userId: number; name: string; avatar: string | null }>]
}>()

const visible = computed({
	get: () => props.visible,
	set: (v: boolean) => emit('update:visible', v),
})

const keyword = ref('')
const loading = ref(false)
const members = ref<PickerMember[]>([])
const selectedIds = ref<number[]>([])
const ownerId = ref<number | null>(null)

const excludedSet = computed(() => new Set(props.excludedUserIds))

const filteredMembers = computed(() => {
	const kw = keyword.value.trim()
	if (!kw) return members.value
	return members.value.filter(m => m.name.includes(kw))
})

const selectableCount = computed(
	() => members.value.filter(m => !isDisabled(m)).length,
)

const hasGray = computed(
	() => members.value.some(m => isDisabled(m)),
)

function isDisabled(m: PickerMember): boolean {
	// 组负责人 + 已设置文档级权限的成员不可选
	return m.isOwner || excludedSet.value.has(m.userId)
}

function toggle(m: PickerMember) {
	if (isDisabled(m)) return
	const idx = selectedIds.value.indexOf(m.userId)
	if (idx >= 0) selectedIds.value.splice(idx, 1)
	else selectedIds.value.push(m.userId)
}

async function loadMembers() {
	loading.value = true
	try {
		const res = await apiGetGroupMembers(props.groupId)
		if (!res.success) {
			msgError(res.message || '加载组成员失败')
			return
		}
		// /api/groups/:id/members 返回的成员里，第一个 immutable_flag=1 的就是组负责人
		// 用 role 推断 isOwner 不准；这里通过 immutableFlag + role 共同判定（飞书同步成员 immutable=1 也存在）
		// 严格做法：拉组详情拿 owner_user_id 比对
		const list: GroupMember[] = res.data
		// 找出组负责人：immutableFlag=1 且 role=PERMISSION_LEVEL.ADMIN 的第一位（PRD：组负责人 immutable + 锁定为管理员）
		const ownerCandidate = list.find(m => m.immutableFlag === 1 && m.role === PERMISSION_LEVEL.ADMIN)
		ownerId.value = ownerCandidate?.userId ?? null

		members.value = list.map(m => ({
			userId: m.userId,
			name: m.name,
			avatar: m.avatar ?? null,
			role: m.role as 1 | 2 | 3,
			isOwner: m.userId === ownerId.value,
		}))
	} finally {
		loading.value = false
	}
}

function onClose() {
	visible.value = false
}

function onConfirm() {
	const picked = members.value.filter(m => selectedIds.value.includes(m.userId))
	emit('confirm', picked.map(m => ({ userId: m.userId, name: m.name, avatar: m.avatar })))
	visible.value = false
}

watch(() => props.visible, (val) => {
	if (val) {
		keyword.value = ''
		selectedIds.value = []
		loadMembers()
	}
})
</script>

<style lang="scss" scoped>
.gp-body {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 360px;
}

.gp-info {
	font-size: 12px;
	color: var(--df-subtext);
}

.gp-list {
	height: 360px;
	border: 1px solid var(--df-border);
	border-radius: 8px;
}

.gp-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 60px 0;
	color: var(--df-subtext);
}

.gp-empty {
	padding: 24px 0;
	display: flex;
	justify-content: center;
}

.gp-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 14px;
	cursor: pointer;
	transition: background 0.15s;

	&:hover:not(.gp-item--disabled) {
		background: var(--df-primary-soft);
	}

	&--checked {
		background: var(--df-primary-soft);
	}

	&--disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
}

.gp-avatar {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	background: var(--df-primary);
	color: #fff;
	font-size: 12px;
	font-weight: 600;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.gp-name {
	flex: 1;
	font-size: 13px;
	color: var(--df-text);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.gp-tag {
	flex-shrink: 0;
	font-size: 11px;
	padding: 2px 6px;
	border-radius: 4px;
	background: var(--df-bg);
	color: var(--df-subtext);

	&--owner {
		background: #fee2e2;
		color: #b91c1c;
	}

	&--exists {
		background: #fef3c7;
		color: #a16207;
	}
}
</style>
