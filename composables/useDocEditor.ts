import { ref, computed, onUnmounted } from 'vue'
import { apiSaveDocContent } from '~/api/document-editor'
import { apiCreateSnapshot } from '~/api/documents'
import type { SaveStatus } from '~/types/document-editor'

const AUTO_SNAPSHOT_INTERVAL = 10 * 60 * 1000 // 10 minutes
const MAX_SNAPSHOT_RETRIES = 3

export function useDocEditor(docId: Ref<number>) {
	const { msgError, msgWarning } = useNotify()
	const saveStatus = ref<SaveStatus>('saved')
	const autoSnapshotFailed = ref(false)
	let pendingContent: string | null = null
	let pendingTitle: string | null = null
	let saveTimer: ReturnType<typeof setTimeout> | null = null
	let snapshotTimer: ReturnType<typeof setInterval> | null = null
	let hasDirtySinceLastSnapshot = false

	function onContentChange(content: string, title?: string) {
		pendingContent = content
		if (title !== undefined) pendingTitle = title
		saveStatus.value = 'unsaved'
		hasDirtySinceLastSnapshot = true
		if (saveTimer) clearTimeout(saveTimer)
		saveTimer = setTimeout(flushSave, 2000)
	}

	async function flushSave() {
		if (pendingContent === null) return
		saveStatus.value = 'saving'
		const snapshot = { content: pendingContent, title: pendingTitle ?? undefined }
		pendingContent = null
		pendingTitle = null
		try {
			await apiSaveDocContent(docId.value, snapshot)
			saveStatus.value = 'saved'
		} catch {
			saveStatus.value = 'error'
			msgError('自动保存失败')
		}
	}

	const saveStatusLabel = computed(() => {
		const map: Record<SaveStatus, string> = {
			saved: '已保存',
			saving: '保存中...',
			unsaved: '未保存',
			error: '保存失败',
		}
		return map[saveStatus.value]
	})

	onUnmounted(() => {
		if (saveTimer) clearTimeout(saveTimer)
		if (snapshotTimer) clearInterval(snapshotTimer)
	})

	// ── 10 分钟自动快照 ──
	async function autoSnapshot() {
		if (!hasDirtySinceLastSnapshot) return
		let retries = 0
		while (retries < MAX_SNAPSHOT_RETRIES) {
			try {
				const res = await apiCreateSnapshot(docId.value, '自动保存')
				if (res.success) {
					hasDirtySinceLastSnapshot = false
					autoSnapshotFailed.value = false
					return
				}
			} catch { /* retry */ }
			retries++
		}
		autoSnapshotFailed.value = true
		msgWarning('⚠ 自动保存快照失败，请检查网络')
	}

	snapshotTimer = setInterval(autoSnapshot, AUTO_SNAPSHOT_INTERVAL)

	return { saveStatus, saveStatusLabel, autoSnapshotFailed, onContentChange, flushSave }
}
