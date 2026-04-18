/**
 * 全局 WebSocket composable
 * - 自动使用 auth token 建立连接
 * - 断线自动重连（指数退避）
 * - 解析服务端消息并更新 wsStore
 */
import type { WsServerMessage, WsBadgePayload } from '~/types/ws'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let reconnectAttempts = 0

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_DELAY = 2000
const MAX_DELAY = 30000
const PING_INTERVAL = 30000

function getWsUrl(token: string): string {
	const loc = window.location
	const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:'
	return `${protocol}//${loc.host}/_ws?token=${encodeURIComponent(token)}`
}

function clearTimers() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer)
		reconnectTimer = null
	}
	if (pingTimer) {
		clearInterval(pingTimer)
		pingTimer = null
	}
}

function startPing() {
	pingTimer = setInterval(() => {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'ping' }))
		}
	}, PING_INTERVAL)
}

function scheduleReconnect(token: string) {
	if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return
	const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), MAX_DELAY)
	reconnectAttempts++
	reconnectTimer = setTimeout(() => {
		connectWs(token)
	}, delay)
}

function handleMessage(event: MessageEvent) {
	const wsStore = useWsStore()
	try {
		const msg: WsServerMessage = JSON.parse(event.data)
		if (msg.type === 'badge') {
			wsStore.updateBadges(msg.payload as WsBadgePayload)
		}
	} catch {
		// 忽略非法消息
	}
}

function connectWs(token: string) {
	if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
		return
	}

	const wsStore = useWsStore()
	const url = getWsUrl(token)

	ws = new WebSocket(url)

	ws.addEventListener('open', () => {
		wsStore.setConnected(true)
		reconnectAttempts = 0
		startPing()
		// 重连成功后对账未读数（动态 import 避免 useWs 强耦合通知模块）
		import('~/composables/useNotificationBadge').then(m => m.reconcileNotificationBadge())
	})

	ws.addEventListener('message', handleMessage)

	ws.addEventListener('close', (e) => {
		wsStore.setConnected(false)
		clearTimers()
		// 4001 = 鉴权失败，不重连
		if (e.code !== 4001) {
			scheduleReconnect(token)
		}
	})

	ws.addEventListener('error', () => {
		// error 事件后会触发 close，由 close 处理重连
	})
}

/** 建立 WebSocket 连接 */
export function wsConnect() {
	if (!import.meta.client) return

	const authStore = useAuthStore()
	if (!authStore.token) return

	connectWs(authStore.token)
}

/** 断开 WebSocket 连接 */
export function wsDisconnect() {
	clearTimers()
	reconnectAttempts = MAX_RECONNECT_ATTEMPTS // 阻止重连

	if (ws) {
		ws.close(1000, 'Client disconnect')
		ws = null
	}

	const wsStore = useWsStore()
	wsStore.setConnected(false)
	wsStore.resetBadges()

	// 重置重连计数以便下次登录可以重连
	reconnectAttempts = 0
}
