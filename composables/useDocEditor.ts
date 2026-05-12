import { ref, computed, onUnmounted } from 'vue'
import { apiSaveDocContent } from '~/api/document-editor'
import type { SaveStatus } from '~/types/document-editor'

export function useDocEditor(docId: Ref<number>) {
	const { msgError } = useNotify()
	const saveStatus = ref<SaveStatus>('saved')
	let pendingContent: string | null = null
	let pendingTitle: string | null = null
	let saveTimer: ReturnType<typeof setTimeout> | null = null

	function onContentChange(content: string, title?: string) {
		pendingContent = content
		if (title !== undefined) pendingTitle = title
		saveStatus.value = 'unsaved'
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
	})

	return { saveStatus, saveStatusLabel, onContentChange, flushSave }
}
