/**
 * WebSocket 连接管理器
 * - 按 userId 跟踪在线 peer
 * - 提供 send / broadcast 工具函数供业务 API 调用
 */
import type { Peer } from 'crossws'
import type { WsServerMessage } from '~/types/ws'

/** peer 扩展信息 */
interface PeerMeta {
	userId: number
	connectedAt: number
}

/** userId → Set<peerId> */
const userPeers = new Map<number, Set<string>>()

/** peerId → Peer */
const peerMap = new Map<string, Peer>()

/** peerId → meta */
const peerMeta = new Map<string, PeerMeta>()

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
	peerMap.delete(id)
	peerMeta.delete(id)
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

/** 获取指定用户在线连接数 */
export function wsUserOnlineCount(userId: number): number {
	return userPeers.get(userId)?.size ?? 0
}

/** 获取全局在线连接数 */
export function wsOnlineCount(): number {
	return peerMap.size
}
