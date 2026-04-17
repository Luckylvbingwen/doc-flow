<template>
	<el-dialog
class="df-modal" :model-value="visible" :title="`「${groupName}」设置`" width="780px"
		:close-on-click-modal="false" destroy-on-close @close="close">
		<el-tabs v-model="activeTab" :before-leave="beforeLeaveTab">
			<el-tab-pane label="审批流配置" name="approval">
				<GroupApprovalPanel ref="approvalPanelRef" :group-id="groupId" @success="emit('success')" />
			</el-tab-pane>

			<el-tab-pane label="成员管理" name="members">
				<GroupMemberPanel ref="memberPanelRef" :group-id="groupId" @invite="openMemberSelector" />
			</el-tab-pane>

			<el-tab-pane label="基本设置" name="basic">
				<el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="gs-basic-form">
					<el-form-item label="组名称" prop="name">
						<el-input v-model="form.name" maxlength="150" show-word-limit />
					</el-form-item>

					<el-form-item label="归属层级">
						<el-input :model-value="scopeLabel" readonly />
					</el-form-item>

					<el-form-item label="描述" prop="description">
						<el-input v-model="form.description" type="textarea" maxlength="500" show-word-limit :rows="3" />
					</el-form-item>

					<el-form-item label="创建时间">
						<el-input :model-value="createdAtText" readonly />
					</el-form-item>

					<el-form-item>
						<el-button type="primary" :loading="saving" @click="handleSaveBasic">保存</el-button>
					</el-form-item>

					<el-divider />

					<el-form-item>
						<el-button type="danger" plain @click="handleDeleteGroup">删除组</el-button>
					</el-form-item>
				</el-form>
			</el-tab-pane>
		</el-tabs>

		<MemberSelectorModal v-model:visible="selectorVisible" :group-id="groupId" @confirm="onMembersSelected" />
	</el-dialog>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import type { GroupDetail } from '~/types/group'
import type { SelectedUser } from '~/types/group-member'
import { apiUpdateGroup, apiDeleteGroup } from '~/api/groups'
import { apiAddGroupMembers } from '~/api/group-members'
import { formatTime } from '~/utils/format'

const props = defineProps<{
	visible: boolean
	groupId: number
	groupName: string
	group?: GroupDetail
}>()

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'success': []
}>()

const activeTab = ref('approval')
const approvalPanelRef = ref<{ isDirty: boolean; reset: () => void } | null>(null)
const selectorVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const memberPanelRef = ref<{ refresh: () => void } | null>(null)

const form = ref({ name: '', description: '' })

const rules: FormRules = {
	name: [{ required: true, message: '请输入组名称', trigger: 'blur' }],
}

const scopeLabel = computed(() => {
	if (!props.group) return ''
	const map: Record<number, string> = { 1: '公司层', 2: '按部门', 3: '按产品线' }
	return map[props.group.scopeType] || ''
})

const createdAtText = computed(() => {
	if (!props.group?.createdAt) return ''
	return formatTime(props.group.createdAt, 'YYYY-MM-DD')
})

watch(() => props.visible, (val) => {
	if (val && props.group) {
		form.value.name = props.group.name
		form.value.description = props.group.description ?? ''
		activeTab.value = 'approval'
	}
})

async function close() {
	if (activeTab.value === 'approval' && approvalPanelRef.value?.isDirty) {
		const ok = await msgConfirm('审批流配置有未保存的修改，确认放弃？', '放弃修改')
		if (!ok) return
		approvalPanelRef.value.reset()
	}
	emit('update:visible', false)
}

async function beforeLeaveTab(_activeName: string | number, oldActiveName: string | number): Promise<boolean> {
	// 仅当离开 approval Tab 且有未保存修改时拦截
	if (oldActiveName === 'approval' && approvalPanelRef.value?.isDirty) {
		const ok = await msgConfirm('审批流配置有未保存的修改，确认放弃？', '放弃修改')
		if (ok && approvalPanelRef.value) {
			approvalPanelRef.value.reset()
		}
		return ok
	}
	return true
}

function openMemberSelector() {
	selectorVisible.value = true
}

async function onMembersSelected(users: SelectedUser[], role: number) {
	if (users.length === 0) return

	const res = await apiAddGroupMembers(props.groupId, {
		members: users.map(u => ({ userId: u.id, role: role as 1 | 2 | 3 })),
	})

	if (res.success) {
		msgSuccess(res.message || '成员已添加')
		memberPanelRef.value?.refresh()
	} else {
		msgError(res.message || '添加失败')
	}
}

async function handleSaveBasic() {
	const valid = await formRef.value?.validate().catch(() => false)
	if (!valid) return

	saving.value = true
	try {
		const res = await apiUpdateGroup(props.groupId, {
			name: form.value.name,
			description: form.value.description || undefined,
		})
		if (res.success) {
			msgSuccess(res.message || '保存成功')
			emit('success')
		} else {
			msgError(res.message || '保存失败')
		}
	} catch {
		msgError('保存失败')
	} finally {
		saving.value = false
	}
}

async function handleDeleteGroup() {
	const confirmed = await msgConfirm(
		'确定删除该组吗？组下有文件时不可删除。',
		'删除组',
		{ danger: true },
	)
	if (!confirmed) return

	const res = await apiDeleteGroup(props.groupId)
	if (res.success) {
		msgSuccess(res.message || '组已删除')
		emit('success')
		close()
	} else {
		msgError(res.message || '删除失败')
	}
}
</script>
