<template>
	<el-dialog
class="df-modal df-doc-permission-modal" :model-value="visible" title="文档权限设置" width="640px"
		:close-on-click-modal="false" destroy-on-close @close="onClose">
		<div v-loading="loading" class="dpm-body">
			<!-- 文件信息 -->
			<div class="dpm-file">
				<div class="dpm-file__name">{{ fileName }}</div>
				<div class="dpm-file__id">文件 ID: {{ documentId }}</div>
			</div>

			<!-- 组权限只读区 -->
			<div class="dpm-section">
				<div class="dpm-section__title">
					组权限
					<span class="dpm-section__sub">（来自组设置，不可修改）</span>
				</div>
				<div v-if="data?.groupMembers?.length" class="dpm-list dpm-list--readonly">
					<div v-for="m in data.groupMembers" :key="m.userId" class="dpm-row dpm-row--readonly">
						<span class="dpm-avatar">{{ m.name.slice(0, 1) }}</span>
						<span class="dpm-name">{{ m.name }}</span>
						<span
v-if="m.isOwner" class="dpm-perm-badge"
							:style="{ color: '#b91c1c', background: '#fee2e2' }">组负责人</span>
						<span
v-else class="dpm-perm-badge"
							:style="{ color: getPermissionMeta(m.role as PermissionLevel).color, background: getPermissionMeta(m.role as PermissionLevel).bg }">
							{{ getPermissionMeta(m.role as PermissionLevel).label }}
						</span>
					</div>
				</div>
				<div v-else-if="!loading" class="dpm-empty">该组暂无其他成员</div>
			</div>

			<!-- 文档级权限区 -->
			<div class="dpm-section">
				<div class="dpm-section__title">
					文档级权限
					<span class="dpm-section__sub">（可自定义，覆盖组权限）</span>
				</div>
				<div v-if="draftPerms.length > 0" class="dpm-list">
					<div v-for="p in draftPerms" :key="p.userId" class="dpm-row">
						<span class="dpm-avatar">{{ p.name.slice(0, 1) }}</span>
						<span class="dpm-name">{{ p.name }}</span>
						<el-select v-model="p.permission" size="small" style="width: 110px">
							<el-option
v-for="opt in DOC_CUSTOM_PERMISSION_OPTIONS" :key="opt.value" :label="opt.label"
								:value="opt.value" />
						</el-select>
						<el-button text size="small" type="danger" @click="removeDraft(p.userId)">
							<el-icon>
								<Close />
							</el-icon>
						</el-button>
					</div>
				</div>
				<div v-else-if="!loading" class="dpm-empty">未设置文档级权限</div>

				<!-- 添加成员区 -->
				<div class="dpm-add-row">
					<el-input
:model-value="pendingDisplay" placeholder="点击选择组成员…" readonly class="dpm-add-row__input"
						@click="pickerVisible = true">
						<template v-if="pendingMembers.length > 0" #suffix>
							<el-icon class="dpm-add-row__clear" @click.stop="pendingMembers = []">
								<CircleClose />
							</el-icon>
						</template>
					</el-input>
					<el-select v-model="pendingPermission" size="default" style="width: 110px">
						<el-option
v-for="opt in DOC_CUSTOM_PERMISSION_OPTIONS" :key="opt.value" :label="opt.label"
							:value="opt.value" />
					</el-select>
					<el-button type="primary" :disabled="pendingMembers.length === 0" @click="addPending">
						添加
					</el-button>
				</div>
			</div>
		</div>

		<template #footer>
			<el-button @click="onClose">取消</el-button>
			<el-button type="primary" :loading="saving" :disabled="!dirty" @click="onSave">
				保存权限
			</el-button>
		</template>

		<!-- 组成员选择器（仅限本组，已自定义成员灰显） -->
		<GroupMemberPickerModal
v-model:visible="pickerVisible" :group-id="groupId" :excluded-user-ids="excludedUserIds"
			@confirm="onPickerConfirm" />
	</el-dialog>
</template>

<script setup lang="ts">
import { Close, CircleClose } from '@element-plus/icons-vue'
import { apiGetDocPermissions, apiPutDocPermissions } from '~/api/document-permissions'
import {
	getPermissionMeta,
	DOC_CUSTOM_PERMISSION_OPTIONS,
	PERMISSION_LEVEL,
	type PermissionLevel,
} from '~/utils/permission-meta'
import type {
	DocPermissionsResponse,
	DocPermissionDraftRow,
} from '~/types/document-permission'

const props = defineProps<{
	visible: boolean
	documentId: number
	/** 文档名（标题展示） */
	fileName: string
	/** 组 ID（用于打开成员选择器 + 权限校验） */
	groupId: number
}>()

const emit = defineEmits<{
	'update:visible': [val: boolean]
	/** 保存成功后通知父组件刷新 hasCustomPermissions 字段 */
	saved: [stats: { inserted: number; updated: number; removed: number }]
}>()

const visible = computed({
	get: () => props.visible,
	set: (v: boolean) => emit('update:visible', v),
})

const loading = ref(false)
const saving = ref(false)
const data = ref<DocPermissionsResponse | null>(null)

/** 文档级权限草稿（保存前的本地编辑态） */
const draftPerms = ref<DocPermissionDraftRow[]>([])
/** 加载时的初始快照，用于 dirty 判定 */
const initialSnapshot = ref<string>('')

/** "添加成员"区当前已选但还没点击"添加"的成员（来自 GroupMemberPickerModal 返回） */
const pendingMembers = ref<Array<{ userId: number; name: string; avatar: string | null }>>([])
const pendingPermission = ref<2 | 3>(PERMISSION_LEVEL.EDIT)
const pickerVisible = ref(false)

const pendingDisplay = computed(() => {
	if (pendingMembers.value.length === 0) return ''
	return pendingMembers.value.map(m => m.name).join('、')
})

const excludedUserIds = computed(() => draftPerms.value.map(p => p.userId))

const dirty = computed(() => {
	const snap = JSON.stringify(
		draftPerms.value.map(p => ({ userId: p.userId, permission: p.permission }))
			.sort((a, b) => a.userId - b.userId),
	)
	return snap !== initialSnapshot.value
})

async function loadData() {
	loading.value = true
	try {
		const res = await apiGetDocPermissions(props.documentId)
		if (!res.success) {
			msgError(res.message || '加载文档权限失败')
			visible.value = false
			return
		}
		data.value = res.data
		draftPerms.value = res.data.customPerms.map(p => ({
			userId: p.userId,
			name: p.name,
			avatar: p.avatar,
			permission: p.permission,
			isNew: false,
		}))
		initialSnapshot.value = JSON.stringify(
			draftPerms.value.map(p => ({ userId: p.userId, permission: p.permission }))
				.sort((a, b) => a.userId - b.userId),
		)
	} finally {
		loading.value = false
	}
}

function onPickerConfirm(members: Array<{ userId: number; name: string; avatar: string | null }>) {
	pendingMembers.value = members
}

function addPending() {
	if (pendingMembers.value.length === 0) return
	for (const m of pendingMembers.value) {
		if (draftPerms.value.some(p => p.userId === m.userId)) continue  // 防御：picker 已灰显，但二次防呆
		draftPerms.value.push({
			userId: m.userId,
			name: m.name,
			avatar: m.avatar,
			permission: pendingPermission.value,
			isNew: true,
		})
	}
	pendingMembers.value = []
	pendingPermission.value = PERMISSION_LEVEL.EDIT
}

function removeDraft(userId: number) {
	const idx = draftPerms.value.findIndex(p => p.userId === userId)
	if (idx < 0) return
	draftPerms.value.splice(idx, 1)
}

async function onSave() {
	if (!dirty.value) {
		visible.value = false
		return
	}
	saving.value = true
	try {
		const res = await apiPutDocPermissions(props.documentId, {
			perms: draftPerms.value.map(p => ({ userId: p.userId, permission: p.permission })),
		})
		if (!res.success) {
			msgError(res.message || '保存失败')
			return
		}
		msgSuccess(res.message || '文档权限已保存')
		emit('saved', res.data)
		visible.value = false
	} catch {
		msgError('保存失败，请重试')
	} finally {
		saving.value = false
	}
}

async function onClose() {
	if (saving.value) return
	if (dirty.value) {
		const confirmed = await msgConfirm('未保存的修改将丢弃，确定关闭吗？', '关闭', { type: 'warning' })
		if (!confirmed) return
	}
	visible.value = false
}

watch(() => props.visible, (val) => {
	if (val) {
		pendingMembers.value = []
		pendingPermission.value = PERMISSION_LEVEL.EDIT
		loadData()
	}
})
</script>

<style lang="scss" scoped>
.dpm-body {
	display: flex;
	flex-direction: column;
	gap: 16px;
	min-height: 360px;
}

.dpm-file {
	&__name {
		font-weight: 600;
		color: var(--df-text);
		font-size: 14px;
	}

	&__id {
		font-size: 12px;
		color: var(--df-subtext);
		margin-top: 2px;
	}
}

.dpm-section {
	&__title {
		font-size: 13px;
		font-weight: 600;
		color: var(--df-text);
		margin-bottom: 8px;
	}

	&__sub {
		font-size: 11px;
		font-weight: 400;
		color: var(--df-subtext);
		margin-left: 4px;
	}
}

.dpm-list {
	border: 1px solid var(--df-border);
	border-radius: 8px;
	overflow: hidden;

	&--readonly {
		opacity: 0.7;
		background: var(--df-surface);
	}
}

.dpm-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 12px;
	border-bottom: 1px solid var(--df-border);

	&:last-child {
		border-bottom: none;
	}

	&--readonly {
		background: var(--df-surface);
	}
}

.dpm-avatar {
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

.dpm-name {
	flex: 1;
	font-size: 13px;
	color: var(--df-text);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dpm-perm-badge {
	display: inline-flex;
	align-items: center;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: 500;
}

.dpm-empty {
	padding: 16px;
	text-align: center;
	font-size: 12px;
	color: var(--df-subtext);
	border: 1px dashed var(--df-border);
	border-radius: 8px;
}

.dpm-add-row {
	display: flex;
	gap: 8px;
	margin-top: 12px;

	&__input {
		flex: 1;
		cursor: pointer;

		:deep(.el-input__inner) {
			cursor: pointer;
		}
	}

	&__clear {
		cursor: pointer;
		color: var(--df-subtext);

		&:hover {
			color: var(--df-primary);
		}
	}
}
</style>
