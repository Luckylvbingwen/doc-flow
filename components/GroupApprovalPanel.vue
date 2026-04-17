<template>
	<div v-loading="loading" class="ap-panel">
		<!-- ① 总开关卡片 -->
		<div class="ap-card ap-switch-card">
			<div class="ap-card__header">
				<span class="ap-card__title">上传需审批</span>
				<el-switch v-model="approvalEnabledBool" />
			</div>
			<div class="ap-switch-card__hint">
				{{ form.approvalEnabled
					? '已开启：普通成员上传文件需经审批人审批后才能发布'
					: '已关闭：所有上传文件将直接发布（组负责人/管理员始终免审批）' }}
			</div>
		</div>

		<!-- ② 关闭态空态 -->
		<div v-if="form.approvalEnabled === 0" class="ap-empty">
			<el-empty description="审批已关闭，所有上传文件将直接发布" :image-size="100">
				<div class="ap-empty__hint">开启后可配置审批模式和审批人</div>
			</el-empty>
		</div>

		<!-- ③ 审批模式 -->
		<div v-else class="ap-card">
			<div class="ap-card__header"><span class="ap-card__title">审批模式</span></div>
			<div class="ap-mode-wrap">
				<div class="ap-mode-card" :class="{ 'ap-mode-card--selected': form.mode === 1 }" @click="form.mode = 1">
					<div class="ap-mode-card__head">
						<el-icon :size="16">
							<Right />
						</el-icon>
						<span>依次审批</span>
					</div>
					<div class="ap-mode-card__desc">按顺序逐个审批，第 1 人通过后才轮到第 2 人，适合需要层级把关的场景。</div>
				</div>
				<div class="ap-mode-card" :class="{ 'ap-mode-card--selected': form.mode === 2 }" @click="form.mode = 2">
					<div class="ap-mode-card__head">
						<el-icon :size="16">
							<Sort />
						</el-icon>
						<span>会签审批</span>
					</div>
					<div class="ap-mode-card__desc">所有审批人同时收到审批请求，全部通过后文件才会发布，适合需要多方确认的场景。</div>
				</div>
			</div>
		</div>

		<!-- ④ 审批人列表 -->
		<div v-if="form.approvalEnabled === 1" class="ap-card">
			<div class="ap-card__header">
				<span class="ap-card__title">审批人</span>
				<span class="ap-card__hint">审批人可以是系统中任何用户</span>
				<el-button type="primary" size="small" :disabled="form.approvers.length >= 20" @click="openSelector">
					<el-icon :size="14">
						<Plus />
					</el-icon>
					添加审批人
				</el-button>
			</div>

			<div class="ap-approver-list">
				<div v-for="(ap, idx) in form.approvers" :key="ap.userId" class="ap-approver-row">
					<span class="ap-approver-row__order">{{ idx + 1 }}</span>
					<span class="ap-approver-row__avatar">{{ ap.name?.slice(0, 1) }}</span>
					<span class="ap-approver-row__name">{{ ap.name }}</span>
					<el-tag v-if="ap.isOwner" type="danger" size="small" effect="plain" round>
						组负责人
					</el-tag>

					<div class="ap-approver-row__actions">
						<el-button text size="small" :disabled="idx === 0" @click="moveUp(idx)">
							<el-icon :size="14">
								<ArrowUp />
							</el-icon>
						</el-button>
						<el-button text size="small" :disabled="idx === form.approvers.length - 1" @click="moveDown(idx)">
							<el-icon :size="14">
								<ArrowDown />
							</el-icon>
						</el-button>
						<el-button v-if="form.approvers.length > 1" text size="small" type="danger" @click="removeApprover(idx)">
							<el-icon :size="14">
								<Close />
							</el-icon>
						</el-button>
					</div>
				</div>
			</div>
		</div>

		<!-- ⑤ 审批链预览 -->
		<div v-if="form.approvalEnabled === 1 && form.approvers.length > 0" class="ap-card ap-preview">
			<div class="ap-card__header">
				<span class="ap-card__title">审批流预览（{{ modeLabel }}）</span>
			</div>

			<!-- 依次 -->
			<div v-if="form.mode === 1" class="ap-chain">
				<div class="ap-chain__node ap-chain__node--neutral">提交人上传</div>
				<template v-for="ap in form.approvers" :key="ap.userId">
					<span class="ap-chain__arrow">→</span>
					<div class="ap-chain__node">
						<span class="ap-chain__avatar">{{ ap.name?.slice(0, 1) }}</span>
						<span>{{ ap.name }}</span>
					</div>
				</template>
				<span class="ap-chain__arrow">→</span>
				<div class="ap-chain__node ap-chain__node--success">发布</div>
			</div>

			<!-- 会签 -->
			<div v-else class="ap-chain">
				<div class="ap-chain__node ap-chain__node--neutral">提交人上传</div>
				<span class="ap-chain__arrow">→</span>
				<div class="ap-chain__parallel">
					<div class="ap-chain__parallel-label">同时审批</div>
					<div v-for="ap in form.approvers" :key="ap.userId" class="ap-chain__parallel-item">
						<span class="ap-chain__avatar">{{ ap.name?.slice(0, 1) }}</span>
						<span>{{ ap.name }}</span>
					</div>
				</div>
				<span class="ap-chain__arrow">→</span>
				<span class="ap-chain__hint">全部通过</span>
				<span class="ap-chain__arrow">→</span>
				<div class="ap-chain__node ap-chain__node--success">发布</div>
			</div>
		</div>

		<!-- ⑥ 底部操作区 -->
		<div class="ap-footer">
			<el-button :disabled="!isDirty" @click="reset">取消修改</el-button>
			<el-button type="primary" :loading="saving" :disabled="!canSave" @click="handleSave">
				保存
			</el-button>
		</div>

		<!-- 审批人选择器 -->
		<MemberSelectorModal
v-model:visible="selectorVisible" :exclude-user-ids="excludeUserIdsForSelector"
			:show-role-selector="false" @confirm="onApproverSelected" />
	</div>
</template>

<script setup lang="ts">
import { Plus, ArrowUp, ArrowDown, Close, Right, Sort } from '@element-plus/icons-vue'
import type { ApprovalTemplate } from '~/types/approval-template'
import { APPROVAL_MODE_MAP } from '~/types/approval-template'
import { apiGetApprovalTemplate, apiSaveApprovalTemplate } from '~/api/approval-template'
import type { SelectedUser } from '~/types/group-member'

const props = defineProps<{
	groupId: number
}>()

const emit = defineEmits<{
	success: []
}>()

const loading = ref(false)
const saving = ref(false)
const selectorVisible = ref(false)

const form = ref<ApprovalTemplate>({
	approvalEnabled: 1,
	mode: 1,
	approvers: [],
})
const original = ref<ApprovalTemplate | null>(null)

// 开关 v-model 桥（0/1 ↔ boolean）
const approvalEnabledBool = computed({
	get: () => form.value.approvalEnabled === 1,
	set: (val: boolean) => { form.value.approvalEnabled = val ? 1 : 0 },
})

const modeLabel = computed(() => APPROVAL_MODE_MAP[form.value.mode] || '')

const excludeUserIdsForSelector = computed(() => form.value.approvers.map(a => a.userId))

const isDirty = computed(() => {
	if (!original.value) return false
	return JSON.stringify(form.value) !== JSON.stringify(original.value)
})

const isValid = computed(() => {
	if (form.value.approvalEnabled === 0) return true
	return form.value.approvers.length >= 1
})

const canSave = computed(() => isDirty.value && isValid.value && !saving.value)

async function load() {
	loading.value = true
	try {
		const res = await apiGetApprovalTemplate(props.groupId)
		if (res.success) {
			form.value = JSON.parse(JSON.stringify(res.data))
			original.value = JSON.parse(JSON.stringify(res.data))
		} else {
			msgError(res.message || '加载审批配置失败')
		}
	} catch (e) {
		msgError((e as Error)?.message || '加载审批配置失败')
	} finally {
		loading.value = false
	}
}

function reset() {
	if (!original.value) return
	form.value = JSON.parse(JSON.stringify(original.value))
}

function openSelector() {
	if (form.value.approvers.length >= 20) return
	selectorVisible.value = true
}

// 审批场景不关心 role 字段，用 _role 占位避免 TS 类型不匹配
function onApproverSelected(users: SelectedUser[], _role?: number) {
	// 追加新审批人，忽略 role（showRoleSelector=false 时虽然仍带 role 字段但审批场景不用）
	for (const u of users) {
		if (form.value.approvers.some(a => a.userId === u.id)) continue
		if (form.value.approvers.length >= 20) break
		form.value.approvers.push({
			userId: u.id,
			name: u.name,
			avatar: u.avatar,
			isOwner: false, // 本地新加的不是 owner；保存后 load 会从服务端拿到准确值
		})
	}
}

function moveUp(idx: number) {
	if (idx === 0) return
	const arr = form.value.approvers
		;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
}

function moveDown(idx: number) {
	const arr = form.value.approvers
	if (idx === arr.length - 1) return
		;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
}

function removeApprover(idx: number) {
	if (form.value.approvers.length <= 1) return
	form.value.approvers.splice(idx, 1)
}

async function handleSave() {
	if (!canSave.value) return
	saving.value = true
	try {
		const res = await apiSaveApprovalTemplate(props.groupId, {
			approvalEnabled: form.value.approvalEnabled,
			mode: form.value.mode,
			approverUserIds: form.value.approvers.map(a => a.userId),
		})
		if (res.success) {
			msgSuccess(res.message || '保存成功')
			emit('success')
			// 重新加载以刷新 isOwner 等服务端计算字段
			await load()
		}
		else {
			msgError(res.message || '保存失败')
		}
	}
	finally {
		saving.value = false
	}
}

defineExpose({
	isDirty,
	reset,
})

watch(() => props.groupId, () => load(), { immediate: true })
</script>
