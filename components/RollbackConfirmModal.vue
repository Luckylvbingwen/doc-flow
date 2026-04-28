<template>
	<el-dialog
v-model="visible" title="版本回滚确认" width="480px" :close-on-click-modal="false" append-to-body
		destroy-on-close class="df-modal df-rollback-modal">
		<template #header>
			<div class="rollback-header">
				<span class="rollback-header-title">版本回滚确认</span>
			</div>
		</template>

		<!-- 图标 + 提示 -->
		<div class="rollback-icon-area">
			<el-icon :size="48" color="var(--el-color-warning)">
				<Sort />
			</el-icon>
			<div class="rollback-hint">确认将文件回滚到历史版本？</div>
		</div>

		<!-- 信息卡片 -->
		<div class="rollback-info-card">
			<div class="rollback-info-row">
				<div class="rollback-info-item">
					<div class="rollback-info-label">文件名</div>
					<div class="rollback-info-value">{{ fileName }}</div>
				</div>
				<div class="rollback-info-item">
					<div class="rollback-info-label">回滚方向</div>
					<div class="rollback-info-value rollback-direction">
						<el-tag type="success" size="small" effect="dark" round>
							{{ currentVersion }}
						</el-tag>
						<el-icon :size="14">
							<Right />
						</el-icon>
						<el-tag type="info" size="small" effect="dark" round>
							{{ targetVersion }}
						</el-tag>
					</div>
				</div>
			</div>
		</div>

		<!-- 警告提示 -->
		<el-alert type="warning" :closable="false" show-icon>
			<template #title>
				回滚将基于 {{ targetVersion }} 的内容创建新版本（版本号递增），不会删除中间版本。新版本将标记"回滚自 {{ targetVersion }}"。
			</template>
		</el-alert>

		<template #footer>
			<el-button @click="visible = false">取消</el-button>
			<el-button type="warning" :loading="loading" @click="onConfirm">
				<el-icon>
					<Check />
				</el-icon>
				确认回滚
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { Check, Right, Sort } from '@element-plus/icons-vue'

defineProps<{
	fileName: string
	currentVersion: string
	targetVersion: string
	loading?: boolean
}>()

const emit = defineEmits<{
	'update:modelValue': [value: boolean]
	'confirm': []
}>()

const visible = defineModel<boolean>({ default: false })

function onConfirm() {
	emit('confirm')
}
</script>
