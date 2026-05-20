/**
 * WebSocket 路由 — /_ws
 * 客户端通过 ws(s)://host/_ws?token=<jwt> 连接
 */
import type { WsServerMessage, WsClientMessage } from '~/types/ws'
import { wsSubscribeDocument, wsUnsubscribeDocument } from '~/server/utils/ws'

export default defineWebSocketHandler({
	async open(peer) {
		// 从 URL 中提取 token 进行鉴权
		const url = peer.request?.url || ''
		const tokenMatch = url.match(/[?&]token=([^&]+)/)
		const token = tokenMatch?.[1]

		if (!token) {
			peer.send(JSON.stringify({ type: 'error', payload: { code: 'AUTH_TOKEN_MISSING' } }))
			peer.close(4001, 'Missing token')
			return
		}

		try {
			const payload = await verifyToken(token)
			wsAddPeer(peer, payload.uid)

			const msg: WsServerMessage = { type: 'connected', payload: { userId: payload.uid } }
			peer.send(JSON.stringify(msg))
		} catch {
			peer.send(JSON.stringify({ type: 'error', payload: { code: 'AUTH_TOKEN_INVALID' } }))
			peer.close(4001, 'Invalid token')
		}
	},

	message(peer, message) {
		// 处理客户端 ping 保活
		try {
			const data = JSON.parse(message.text()) as WsClientMessage
			if (data.type === 'ping') {
				peer.send(JSON.stringify({ type: 'pong' }))
				return
			}
			if (data.type === 'subscribe-document') {
				const documentId = Number(data.payload?.documentId)
				if (Number.isFinite(documentId) && documentId > 0) {
					wsSubscribeDocument(peer, documentId)
				}
				return
			}
			if (data.type === 'unsubscribe-document') {
				const documentId = Number(data.payload?.documentId)
				if (Number.isFinite(documentId) && documentId > 0) {
					wsUnsubscribeDocument(peer, documentId)
				}
			}
		} catch {
			// 忽略非法消息
		}
	},

	close(peer) {
		wsRemovePeer(peer)
	},

	error(peer) {
		wsRemovePeer(peer)
	}
})
