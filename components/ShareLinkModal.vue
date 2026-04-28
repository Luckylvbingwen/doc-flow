<template>
	<Modal
v-model="visible" title="分享文档" width="480px" :confirm-loading="loading" confirm-text="生成链接"
		@confirm="onGenerate" @cancel="visible = false">
		<div class="df-share-modal">
			<p class="df-share-modal__hint">为「{{ fileName }}」生成分享链接，仅限组织内部成员使用。</p>

			<div class="df-share-modal__perm">
				<span class="df-share-modal__perm-label">权限设置</span>
				<el-radio-group v-model="selectedPermission">
					<el-radio-button :value="4">可阅读</el-radio-button>
					<el-radio-button :value="2">可编辑</el-radio-button>
				</el-radio-group>
			</div>

			<div v-if="shareUrl" class="df-share-modal__result">
				<el-input :model-value="fullUrl" readonly>
					<template #append>
						<el-button @click="onCopy">复制链接</el-button>
					</template>
				</el-input>
			</div>
		</div>
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
	useCopy(fullUrl.value, '链接已复制')
}
</script>

<style scoped>
.df-share-modal {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.df-share-modal__hint {
	font-size: 13px;
	color: var(--df-subtext);
	margin: 0;
}

.df-share-modal__perm {
	display: flex;
	align-items: center;
	gap: 12px;
}

.df-share-modal__perm-label {
	font-size: 13px;
	font-weight: 600;
	color: var(--df-text);
}

.df-share-modal__result {
	margin-top: 4px;
}
</style>
