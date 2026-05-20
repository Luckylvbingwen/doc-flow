/**
 * WebSocket 连接管理器
 * - 按 userId 跟踪在线 peer
 * - 提供 send / broadcast 工具函数供业务 API 调用
 */
import type { Peer } from 'crossws'
import type { WsServerMessage, WsAnnotationSyncPayload  } from '~/types/ws'

import type { PeerMeta } from '~/server/types/ws'

/** userId → Set<peerId> */
const userPeers = new Map<number, Set<string>>()

/** peerId → Peer */
const peerMap = new Map<string, Peer>()

/** peerId → meta */
const peerMeta = new Map<string, PeerMeta>()

/** docId → Set<peerId> */
const documentPeers = new Map<number, Set<string>>()

/** peerId → Set<docId> */
const peerDocuments = new Map<string, Set<number>>()

/** 注册连接 */
export function wsAddPeer(peer: Peer, userId: number) {
	const id = peer.id ?? peer.toString()
	peerMap.set(id, peer)
	peerMeta.set(id, { userId, connectedAt: Date.now() })

	if (!userPeers.has(userId)) {
		userPeers.set(userId, new Set())
	}
	userPeers.get(userId)!.add(id)
}

/** 移除连接 */
export function wsRemovePeer(peer: Peer) {
	const id = peer.id ?? peer.toString()
	const meta = peerMeta.get(id)
	if (meta) {
		const peers = userPeers.get(meta.userId)
		if (peers) {
			peers.delete(id)
			if (peers.size === 0) userPeers.delete(meta.userId)
		}
	}
	const docs = peerDocuments.get(id)
	if (docs) {
		for (const docId of docs) {
			const peers = documentPeers.get(docId)
			if (!peers) continue
			peers.delete(id)
			if (peers.size === 0) documentPeers.delete(docId)
		}
		peerDocuments.delete(id)
	}
	peerMap.delete(id)
	peerMeta.delete(id)
}

/** 订阅文档实时频道 */
export function wsSubscribeDocument(peer: Peer, documentId: number) {
	if (!Number.isFinite(documentId) || documentId <= 0) return
	const peerId = peer.id ?? peer.toString()

	if (!documentPeers.has(documentId)) {
		documentPeers.set(documentId, new Set())
	}
	documentPeers.get(documentId)!.add(peerId)

	if (!peerDocuments.has(peerId)) {
		peerDocuments.set(peerId, new Set())
	}
	peerDocuments.get(peerId)!.add(documentId)
}

/** 取消订阅文档实时频道 */
export function wsUnsubscribeDocument(peer: Peer, documentId: number) {
	if (!Number.isFinite(documentId) || documentId <= 0) return
	const peerId = peer.id ?? peer.toString()

	const peers = documentPeers.get(documentId)
	if (peers) {
		peers.delete(peerId)
		if (peers.size === 0) documentPeers.delete(documentId)
	}

	const docs = peerDocuments.get(peerId)
	if (docs) {
		docs.delete(documentId)
		if (docs.size === 0) peerDocuments.delete(peerId)
	}
}

/** 向指定用户的所有连接发送消息 */
export function wsSendToUser(userId: number, message: WsServerMessage) {
	const peers = userPeers.get(userId)
	if (!peers) return

	const data = JSON.stringify(message)
	for (const peerId of peers) {
		const peer = peerMap.get(peerId)
		if (peer) {
			try {
				peer.send(data)
			} catch {
				// peer 已断开，忽略
			}
		}
	}
}

/** 向所有连接广播消息 */
export function wsBroadcast(message: WsServerMessage) {
	const data = JSON.stringify(message)
	for (const peer of peerMap.values()) {
		try {
			peer.send(data)
		} catch {
			// peer 已断开，忽略
		}
	}
}

/** 向订阅该文档的所有连接发送消息 */
export function wsSendToDocument(documentId: number, message: WsServerMessage) {
	const peers = documentPeers.get(documentId)
	if (!peers || peers.size === 0) return

	const data = JSON.stringify(message)
	for (const peerId of peers) {
		const peer = peerMap.get(peerId)
		if (!peer) continue
		try {
			peer.send(data)
		} catch {
			// peer 已断开，忽略
		}
	}
}

/** 广播批注同步事件（用于多人协作时批注实时刷新） */
export function wsBroadcastAnnotationSync(payload: WsAnnotationSyncPayload) {
	wsSendToDocument(payload.documentId, {
		type: 'annotation-sync',
		payload,
	})
}

/** 获取指定用户在线连接数 */
export function wsUserOnlineCount(userId: number): number {
	return userPeers.get(userId)?.size ?? 0
}

/** 获取全局在线连接数 */
export function wsOnlineCount(): number {
	return peerMap.size
}
