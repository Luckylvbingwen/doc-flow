<template>
	<div class="editor-shell">
		<!-- ─── 顶栏 ─── -->
		<header class="editor-topbar">
			<div class="editor-topbar__left">
				<el-button link class="editor-back-btn" @click="handleBack">
					<el-icon>
						<ArrowLeft />
					</el-icon>
				</el-button>
				<input v-model="title" class="editor-title-input" placeholder="未命名文档" maxlength="255" @input="onTitleInput">
				<span class="editor-save-status" :class="`is-${saveStatus}`">{{ saveStatusLabel }}</span>
			</div>

			<div class="editor-topbar__right">
				<!-- 批注面板切换 -->
				<el-button size="small" @click="annotationOpen = !annotationOpen">批注</el-button>
				<!-- 提交发布 -->
				<el-button type="primary" size="small" :disabled="saveStatus === 'saving'" @click="handlePublish">
					提交发布
				</el-button>
				<!-- 更多 -->
				<el-dropdown trigger="click">
					<el-button size="small">
						<el-icon>
							<MoreFilled />
						</el-icon>
					</el-button>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item @click="handleTransfer">转移归属人</el-dropdown-item>
							<el-dropdown-item @click="handleShare">分享</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</div>
		</header>

		<!-- ─── 主体 ─── -->
		<div class="editor-body">
			<!-- 编辑区 -->
			<main class="editor-main">
				<ClientOnly>
					<MilkdownEditor
v-if="!loading && content !== null" ref="milkdownRef" :initial-content="content"
						:doc-id="docId" :enable-collab="enableCollab" @update="onEditorUpdate"
						@presence-update="onPresenceUpdate" />
					<div v-else class="editor-loading">
						<el-skeleton :rows="8" animated />
					</div>
				</ClientOnly>
			</main>

			<!-- 批注面板 -->
			<aside v-if="annotationOpen" class="editor-annotation-aside">
				<AnnotationPanel :doc-id="docId" />
			</aside>
		</div>

		<!-- 发布弹窗复用 -->
		<PublishModal v-if="publishTarget" v-model="publishModalVisible" :doc="publishTarget" @success="onPublishSuccess" />

		<!-- 转移归属人弹窗复用 -->
		<OwnershipTransferModal
v-if="docId" v-model="transferModalVisible" :document-id="docId" :document-title="title"
			:exclude-user-id="currentUserId" @success="handleBack" />

		<!-- 分享弹窗复用 -->
		<ShareLinkModal v-if="docId" v-model="shareModalVisible" :document-id="docId" :file-name="`${title}.md`" />
	</div>
</template>

<script setup lang="ts">
import { ArrowLeft, MoreFilled } from '@element-plus/icons-vue'
import { apiGetDocContent } from '~/api/document-editor'
import { useDocEditor } from '~/composables/useDocEditor'
import type { PersonalDocItem } from '~/types/personal'

definePageMeta({ layout: 'editor' })
useHead({ title: '编辑器 - DocFlow' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { msgError } = useNotify()
const currentUserId = computed(() => authStore.user?.id ?? 0)

const docId = computed(() => Number(route.params.id))
const enableCollab = ref(true)

// ── 内容加载 ──
const title = ref('未命名文档')
const content = ref<string | null>(null)
const loading = ref(true)

onMounted(async () => {
	const res = await apiGetDocContent(docId.value)
	if (res.success) {
		title.value = res.data.title
		content.value = res.data.content
	} else {
		msgError(res.message || '加载失败')
		router.back()
	}
	loading.value = false
})

// ── 自动保存 ──
const { saveStatus, saveStatusLabel, onContentChange, flushSave } = useDocEditor(docId)

const milkdownRef = ref<{ getMarkdown: () => string } | null>(null)

function onEditorUpdate(markdown: string) {
	onContentChange(markdown, undefined)
}

function onTitleInput() {
	onContentChange(milkdownRef.value?.getMarkdown() ?? '', title.value)
}

// ── Presence ──
const onlineUsers = ref<Array<{ id: number; name: string; color: string }>>([])
function onPresenceUpdate(users: typeof onlineUsers.value) {
	onlineUsers.value = users.filter(u => u.id !== currentUserId.value)
}

// ── 返回 ──
async function handleBack() {
	await flushSave()
	router.back()
}

// ── 发布 ──
const publishModalVisible = ref(false)
const publishTarget = computed<PersonalDocItem | null>(() => {
	if (!docId.value) return null
	return { id: docId.value, title: title.value, ext: 'md', status: 1 } as PersonalDocItem
})

function handlePublish() {
	publishModalVisible.value = true
}

function onPublishSuccess() {
	publishModalVisible.value = false
	router.back()
}

// ── 批注面板 ──
const annotationOpen = ref(false)

// ── 转移/分享弹窗 ──
const transferModalVisible = ref(false)
const shareModalVisible = ref(false)

function handleTransfer() { transferModalVisible.value = true }
function handleShare() { shareModalVisible.value = true }
</script>

<style>
.editor-shell {
	display: flex;
	flex-direction: column;
	height: 100vh;
	overflow: hidden;
}

.editor-topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 16px;
	height: 52px;
	border-bottom: 1px solid var(--df-border);
	background: var(--df-panel);
	flex-shrink: 0;
	gap: 12px;
}

.editor-topbar__left {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 0;
}

.editor-topbar__right {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

.editor-back-btn {
	padding: 4px;
}

.editor-title-input {
	flex: 1;
	min-width: 0;
	border: none;
	outline: none;
	background: transparent;
	font-size: 15px;
	font-weight: 600;
	color: var(--df-text);
}

.editor-save-status {
	font-size: 12px;
	color: var(--df-subtext);
	white-space: nowrap;
}

.editor-save-status.is-error {
	color: var(--el-color-danger);
}

.editor-save-status.is-saving {
	color: var(--el-color-primary);
}

.editor-body {
	display: flex;
	flex: 1;
	overflow: hidden;
}

.editor-main {
	flex: 1;
	overflow-y: auto;
	padding: 32px 0;
}

.editor-annotation-aside {
	width: 300px;
	border-left: 1px solid var(--df-border);
	overflow-y: auto;
	flex-shrink: 0;
}

.editor-loading {
	padding: 48px 48px;
}
</style>
