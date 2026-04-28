<template>
	<Modal v-model="visible" :title="`分享文档 — ${fileName}`" width="520px" @cancel="visible = false">
		<div class="df-share-modal">
			<!-- 分享链接 -->
			<div v-if="shareUrl" class="df-share-modal__section">
				<div class="df-share-modal__label">分享链接</div>
				<div class="df-share-modal__url-box">
					{{ fullUrl }}
				</div>
			</div>

			<!-- 权限设置 -->
			<div class="df-share-modal__section">
				<div class="df-share-modal__label">权限设置</div>
				<label
class="df-share-modal__perm-card" :class="{ active: selectedPermission === 4 }"
					@click="selectedPermission = 4">
					<input type="radio" :checked="selectedPermission === 4">
					<div>
						<div class="df-share-modal__perm-title">可阅读</div>
						<div class="df-share-modal__perm-desc">对方可查看文档，无阅读权限时可申请</div>
					</div>
				</label>
				<label
class="df-share-modal__perm-card" :class="{ active: selectedPermission === 2 }"
					@click="selectedPermission = 2">
					<input type="radio" :checked="selectedPermission === 2">
					<div>
						<div class="df-share-modal__perm-title">可编辑</div>
						<div class="df-share-modal__perm-desc">对方可加入实时协同编辑</div>
					</div>
				</label>
			</div>

			<!-- 提示 -->
			<div class="df-share-modal__warning">
				仅支持分享给组织内部人员（飞书 SSO 用户）
			</div>
		</div>

		<template #footer>
			<el-button v-if="shareUrl" type="primary" @click="onCopy">复制链接</el-button>
			<el-button v-else type="primary" :loading="loading" @click="onGenerate">生成链接</el-button>
			<el-button @click="visible = false">关闭</el-button>
		</template>
	</Modal>
</template>

<script setup lang="ts">
import { apiCreateShareLink } from '~/api/share'

const props = defineProps<{
	documentId: number
	fileName: string
}>()

const visible = defineModel<boolean>({ default: false })

const selectedPermission = ref<2 | 4>(4)
const loading = ref(false)
const shareUrl = ref('')

const fullUrl = computed(() => {
	if (!shareUrl.value) return ''
	return `${window.location.origin}${shareUrl.value}`
})

watch(visible, (val) => {
	if (val) {
		shareUrl.value = ''
		selectedPermission.value = 4
	}
})

// 切换权限时清除已生成的链接（不同权限对应不同链接）
watch(selectedPermission, () => {
	shareUrl.value = ''
})

async function onGenerate() {
	loading.value = true
	try {
		const res = await apiCreateShareLink(props.documentId, selectedPermission.value)
		if (res.success) {
			shareUrl.value = res.data.url
			msgSuccess(res.message || '链接已生成')
		} else {
			msgError(res.message || '生成失败')
		}
	} catch {
		msgError('生成链接失败')
	} finally {
		loading.value = false
	}
}

function onCopy() {
	useCopy(fullUrl.value, '链接已复制到剪贴板')
}
</script>

<style scoped>
.df-share-modal {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.df-share-modal__section {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.df-share-modal__label {
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
}

.df-share-modal__url-box {
	font-size: 12px;
	background: var(--df-surface);
	padding: 8px 12px;
	border: 1px solid var(--df-border);
	border-radius: 6px;
	color: var(--df-text);
	word-break: break-all;
	user-select: all;
}

.df-share-modal__perm-card {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	border: 1px solid var(--df-border);
	border-radius: 6px;
	cursor: pointer;
	font-size: 13px;
	transition: border-color 0.2s;

	&:hover {
		border-color: var(--df-primary);
	}

	&.active {
		border-color: var(--df-primary);
		background: var(--df-primary-soft);
	}

	input[type="radio"] {
		accent-color: var(--df-primary);
		margin: 0;
		flex-shrink: 0;
	}
}

.df-share-modal__perm-title {
	font-weight: 500;
	color: var(--df-text);
}

.df-share-modal__perm-desc {
	font-size: 11px;
	color: var(--df-subtext);
	margin-top: 2px;
}

.df-share-modal__warning {
	padding: 10px 14px;
	background: #fef3c7;
	border-radius: 8px;
	font-size: 12px;
	color: #92400e;
}
</style>
