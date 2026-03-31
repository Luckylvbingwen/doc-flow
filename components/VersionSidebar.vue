<template>
	<div class="df-version-sidebar">
		<div class="vs-title">
			<el-icon :size="16">
				<Clock />
			</el-icon>
			版本记录
			<span class="vs-count">{{ versions.length }} 个版本</span>
		</div>
		<el-scrollbar max-height="calc(100vh - 300px)">
			<div style="padding: 8px">
				<div v-for="v in versions" :key="v.id" class="df-ver-item" :class="{ current: v.isCurrent }">
					<div class="ver-num">
						{{ v.versionNo }}
						<span v-if="v.isCurrent" class="ver-badge">当前</span>
						<span v-if="v.rollbackFrom" style="font-size: 10px; color: var(--df-subtext)">
							回滚自 {{ v.rollbackFrom }}
						</span>
					</div>
					<div class="ver-meta">
						{{ v.uploaderName }} · {{ formatTime(v.createdAt) }}
					</div>
					<div v-if="v.changeNote" class="ver-note">{{ v.changeNote }}</div>
					<div class="ver-actions">
						<el-button size="small" text @click="emit('download', v)">
							<el-icon>
								<Download />
							</el-icon>
							下载
						</el-button>
						<el-button v-if="!v.isCurrent" size="small" text type="warning" @click="emit('rollback', v)">
							<el-icon>
								<RefreshLeft />
							</el-icon>
							回滚
						</el-button>
						<el-button v-if="!v.isCurrent" size="small" text type="primary" @click="emit('compare', v)">
							<el-icon>
								<Switch />
							</el-icon>
							对比
						</el-button>
					</div>
				</div>
				<div v-if="versions.length === 0" style="
						text-align: center;
						padding: 24px;
						color: var(--df-subtext);
						font-size: 13px;
					">
					暂无版本记录
				</div>
			</div>
		</el-scrollbar>
		<div class="vs-footer">
			<el-button type="primary" style="width: 100%" @click="emit('upload')">
				<el-icon>
					<Upload />
				</el-icon>
				上传新版本
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Clock, Download, RefreshLeft, Switch, Upload } from '@element-plus/icons-vue'
import type { VersionInfo } from '~/types/version'
import { formatTime } from '~/utils/format'

defineProps<{
	versions: VersionInfo[]
}>()

const emit = defineEmits<{
	download: [version: VersionInfo]
	rollback: [version: VersionInfo]
	compare: [version: VersionInfo]
	upload: []
}>()
</script>
