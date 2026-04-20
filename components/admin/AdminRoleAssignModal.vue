<template>
	<el-dialog
class="df-modal admin-role-modal" :model-value="visible" title="角色指派" width="540px"
		:close-on-click-modal="false" destroy-on-close @close="close">
		<!-- 用户信息头 -->
		<div v-if="user" class="arm-user-card">
			<el-avatar v-if="user.avatarUrl" :src="user.avatarUrl" :size="40" />
			<div v-else class="arm-user-fallback">{{ fallbackInitial }}</div>
			<div class="arm-user-meta">
				<div class="arm-user-name">{{ user.name }}</div>
				<div class="arm-user-email">{{ user.email || '未设置邮箱' }}</div>
			</div>
		</div>

		<div class="arm-section-title">角色指派</div>

		<div class="arm-role-cards">
			<!-- 公司层管理员卡 -->
			<label class="arm-role-card" :class="{ 'is-active': form.companyAdmin }">
				<el-checkbox v-model="form.companyAdmin" />
				<div class="arm-role-body">
					<div class="arm-role-name">公司层管理员</div>
					<div class="arm-role-desc">可创建和管理公司层的组，不自动进入子组成员表</div>
				</div>
			</label>

			<!-- 产品线负责人卡 -->
			<label class="arm-role-card" :class="{ 'is-active': form.plHead }">
				<el-checkbox v-model="form.plHead" />
				<div class="arm-role-body">
					<div class="arm-role-name">产品线负责人</div>
					<div class="arm-role-desc">
						自动继承到所有子孙项目组成员表（权限 = 管理员），可指派产品线管理员
					</div>

					<!-- 展开：当前负责的产品线（只读） -->
					<div v-if="form.plHead" class="arm-role-scope">
						<div v-if="productLines.length > 0">
							<div class="arm-scope-label">负责的产品线</div>
							<div class="arm-scope-tags">
								<span v-for="pl in productLines" :key="pl.id" class="arm-scope-tag">
									{{ pl.name }}
								</span>
							</div>
						</div>
						<div v-else class="arm-scope-empty">暂未负责任何产品线</div>
						<div class="arm-scope-hint">
							在「创建/编辑产品线」中指派该用户为 owner，即建立具体负责关系。
						</div>
					</div>
				</div>
			</label>
		</div>

		<template #footer>
			<el-button @click="close">取消</el-button>
			<el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import type { AdminUserItem, AdminSystemRoleCode } from '~/types/admin'
import { apiPutAdminUserRoles } from '~/api/admin'

const props = defineProps<{
	visible: boolean
	user: AdminUserItem | null
}>()

const emit = defineEmits<{
	'update:visible': [value: boolean]
	'success': []
}>()

const form = ref({
	companyAdmin: false,
	plHead: false,
})

const submitting = ref(false)

const fallbackInitial = computed(() => {
	const name = props.user?.name ?? ''
	return name.charAt(0) || '?'
})

const productLines = computed(() => props.user?.scopes.productLines ?? [])

// 打开时按 user 当前角色预填
watch(() => props.visible, (val) => {
	if (!val || !props.user) return
	const codes = props.user.roles.map(r => r.code as AdminSystemRoleCode)
	form.value.companyAdmin = codes.includes('company_admin')
	form.value.plHead = codes.includes('pl_head')
})

function close() {
	emit('update:visible', false)
}

async function handleSave() {
	if (!props.user) return

	// 二次确认：取消产品线负责人时
	const currentlyPlHead = props.user.roles.some(r => r.code === 'pl_head')
	if (currentlyPlHead && !form.value.plHead) {
		const confirmed = await msgConfirm(
			`确定取消「${props.user.name}」的产品线负责人角色？`,
			'取消确认',
			{ confirmText: '取消角色', danger: true },
		)
		if (!confirmed) return
	}

	submitting.value = true
	try {
		const res = await apiPutAdminUserRoles(props.user.id, {
			companyAdmin: form.value.companyAdmin,
			plHead: form.value.plHead,
		})
		if (res.success) {
			msgSuccess(res.message || `「${props.user.name}」的角色已更新`)
			emit('success')
			close()
		} else {
			msgError(res.message || '操作失败')
		}
	} catch {
		msgError('操作失败')
	} finally {
		submitting.value = false
	}
}
</script>

<style lang="scss" scoped>
.arm-user-card {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px;
	background: var(--df-surface);
	border-radius: 8px;
	margin-bottom: 20px;
}

.arm-user-fallback {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	background: #6366f1;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	font-weight: 600;
	flex-shrink: 0;
}

.arm-user-meta {
	min-width: 0;
	flex: 1;
}

.arm-user-name {
	font-size: 15px;
	font-weight: 600;
	color: var(--df-text);
	line-height: 1.4;
}

.arm-user-email {
	font-size: 12px;
	color: var(--df-subtext);
	line-height: 1.4;
	margin-top: 2px;
	word-break: break-all;
}

.arm-section-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
	margin-bottom: 12px;
}

.arm-role-cards {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.arm-role-card {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	padding: 12px;
	border: 1px solid var(--df-border);
	border-radius: 8px;
	cursor: pointer;
	transition: border-color 0.15s, background-color 0.15s;
	background: #fff;

	&:hover {
		border-color: var(--df-primary);
	}

	&.is-active {
		border-color: var(--df-primary);
		background: var(--df-primary-soft);
	}

	:deep(.el-checkbox) {
		margin-top: 2px;
		height: auto;
	}

	:deep(.el-checkbox__label) {
		display: none;
	}
}

.arm-role-body {
	flex: 1;
	min-width: 0;
}

.arm-role-name {
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
	line-height: 1.4;
}

.arm-role-desc {
	font-size: 12px;
	color: var(--df-subtext);
	margin-top: 2px;
	line-height: 1.5;
}

.arm-role-scope {
	margin-top: 10px;
	padding-top: 10px;
	border-top: 1px solid var(--df-border);
}

.arm-scope-label {
	font-size: 12px;
	color: var(--df-subtext);
	margin-bottom: 6px;
}

.arm-scope-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-bottom: 8px;
}

.arm-scope-tag {
	display: inline-flex;
	align-items: center;
	padding: 4px 10px;
	border-radius: 16px;
	font-size: 12px;
	background: var(--df-primary-soft);
	color: var(--df-primary);
	border: 1px solid var(--df-primary);
}

.arm-scope-empty {
	font-size: 12px;
	color: var(--df-subtext);
	margin-bottom: 8px;
}

.arm-scope-hint {
	font-size: 11px;
	color: var(--df-subtext);
	line-height: 1.5;
}
</style>
