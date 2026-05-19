<template>
	<MilkdownProvider>
		<div ref="editorRoot" class="milkdown-host" />
	</MilkdownProvider>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

const props = defineProps<{
	initialContent: string
	readonly?: boolean
	docId?: number
	enableCollab?: boolean
}>()

const emit = defineEmits<{
	(e: 'update', content: string): void
	(e: 'presenceUpdate', users: Array<{ id: number; name: string; color: string }>): void
}>()

const editorRoot = ref<HTMLElement>()
let crepe: Crepe | null = null

// 协同相关（懒加载，仅 enableCollab=true 时初始化）
let ydoc: import('yjs').Doc | null = null
let wsProvider: import('y-websocket').WebsocketProvider | null = null

onMounted(async () => {
	if (!editorRoot.value) return

	crepe = new Crepe({
		root: editorRoot.value,
		defaultValue: props.initialContent,
		features: {
			[Crepe.Feature.Latex]: true,
		},
		featureConfigs: {
			[Crepe.Feature.Placeholder]: {
				text: '输入 / 插入内容，或直接开始写作...',
			},
		},
	})

	crepe.on(listener => {
		listener.markdownUpdated((_ctx, markdown) => {
			emit('update', markdown)
		})
	})

	await crepe.create()

	if (props.readonly) crepe.setReadonly(true)

	// 协同接入
	if (props.enableCollab && props.docId) {
		await setupCollab(props.docId)
	}
})

async function setupCollab(docId: number) {
	if (!crepe) return
	const [{ Doc }, { WebsocketProvider }, { collab, collabServiceCtx }] = await Promise.all([
		import('yjs'),
		import('y-websocket'),
		import('@milkdown/plugin-collab'),
	])

	const authStore = useAuthStore()
	const token = authStore.token ?? ''
	const wsHost = (useRuntimeConfig().public.hocuspocusUrl as string) ?? `ws://${location.host.replace(/:\d+$/, '')}:1234`

	ydoc = new Doc()
	wsProvider = new WebsocketProvider(wsHost, `doc-${docId}`, ydoc, {
		params: { token },
	})

	// 光标位置同步节流 100ms（PRD 要求）
	const rawSetLocal = wsProvider.awareness.setLocalStateField.bind(wsProvider.awareness)
	let cursorThrottleTimer: ReturnType<typeof setTimeout> | null = null
	let pendingCursor: { field: string; value: unknown } | null = null
	wsProvider.awareness.setLocalStateField = (field: string, value: unknown) => {
		if (field === 'cursor' || field === 'selection') {
			pendingCursor = { field, value }
			if (!cursorThrottleTimer) {
				cursorThrottleTimer = setTimeout(() => {
					if (pendingCursor) rawSetLocal(pendingCursor.field, pendingCursor.value)
					cursorThrottleTimer = null
					pendingCursor = null
				}, 100)
			}
		} else {
			rawSetLocal(field, value)
		}
	}

	crepe.editor.use(collab)

	wsProvider.once('sync', (isSynced: boolean) => {
		if (!isSynced || !ydoc || !wsProvider) return
		crepe!.editor.action(ctx => {
			const collabService = ctx.get(collabServiceCtx)
			collabService.bindDoc(ydoc!).setAwareness(wsProvider!.awareness).connect()
		})
	})

	// Presence
	wsProvider.awareness.on('change', () => {
		const states = Array.from(wsProvider!.awareness.getStates().values())
		const users = states.map((s: Record<string, unknown>) => s.user).filter(Boolean) as Array<{ id: number; name: string; color: string }>
		emit('presenceUpdate', users)
	})

	// 设置自身 presence
	const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6']
	wsProvider.awareness.setLocalStateField('user', {
		id: authStore.user?.id,
		name: authStore.user?.name,
		color: colors[(authStore.user?.id ?? 0) % colors.length],
	})
}

onUnmounted(async () => {
	wsProvider?.destroy()
	ydoc?.destroy()
	await crepe?.destroy()
	crepe = null
})

defineExpose({
	getMarkdown: () => crepe?.getMarkdown() ?? '',
	setReadonly: (val: boolean) => crepe?.setReadonly(val),
})
</script>

<style>
.milkdown-host {
	width: 100%;
	height: 100%;
}

/* 覆盖 Milkdown 默认样式以适配项目主色 */
.milkdown .editor {
	padding: 0 48px 120px;
	max-width: 900px;
	margin: 0 auto;
	font-size: 15px;
	line-height: 1.75;
}
</style>
