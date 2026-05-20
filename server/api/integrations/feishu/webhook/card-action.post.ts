import { prisma } from '~/server/utils/prisma'
import { updateFeishuCardResultByMessage } from '~/server/utils/notify'
import {
	executeCrossMoveAction,
	executeOwnershipTransferAction,
	executePermissionRequestAction,
} from '~/server/utils/feishu-card-actions'
import type { FeishuCardActionPayload } from '~/server/types/notification'

const logger = useLogger('feishu-card-action')
const processedEventIds = new Set<string>()

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? value as Record<string, unknown>
		: null
}

function readNested(root: Record<string, unknown>, paths: string[][]): unknown {
	for (const path of paths) {
		let current: unknown = root
		let hit = true
		for (const key of path) {
			if (Array.isArray(current)) {
				const index = Number(key)
				if (!Number.isInteger(index) || index < 0 || index >= current.length) {
					hit = false
					break
				}
				current = current[index]
				continue
			}

			const obj = asRecord(current)
			if (!obj || !(key in obj)) {
				hit = false
				break
			}
			current = obj[key]
		}
		if (hit) return current
	}
	return undefined
}

function parseActionPayload(raw: unknown): (FeishuCardActionPayload & { intent: 'approve' | 'reject' }) | null {
	let value = raw
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value)
		} catch {
			return null
		}
	}
	const record = asRecord(value)
	if (!record) return null
	if (record.intent !== 'approve' && record.intent !== 'reject') return null
	if (record.kind === 'ownership-transfer' && typeof record.documentId === 'number') {
		return { kind: 'ownership-transfer', documentId: record.documentId, intent: record.intent }
	}
	if (record.kind === 'cross-move' && Array.isArray(record.moveIds) && record.moveIds.every(item => typeof item === 'number')) {
		return { kind: 'cross-move', moveIds: record.moveIds, intent: record.intent }
	}
	if (
		record.kind === 'permission-request' &&
		typeof record.documentId === 'number' &&
		typeof record.requestId === 'number'
	) {
		return {
			kind: 'permission-request',
			documentId: record.documentId,
			requestId: record.requestId,
			intent: record.intent,
		}
	}
	return null
}

export default defineEventHandler(async (event) => {
	const body = await readBody(event)
	const root = asRecord(body) ?? {}
	const token = readNested(root, [['token'], ['header', 'token']])
	const config = useRuntimeConfig()
	const expectedToken = String(config.feishuVerificationToken || '')

	if (root.type === 'url_verification') {
		if (expectedToken && token !== expectedToken) {
			setResponseStatus(event, 403)
			return { error: 'invalid token' }
		}
		return { challenge: root.challenge }
	}

	if (expectedToken && token !== expectedToken) {
		setResponseStatus(event, 403)
		return { error: 'invalid token' }
	}

	const eventId = readNested(root, [['header', 'event_id'], ['event_id']])
	if (typeof eventId === 'string' && eventId) {
		if (processedEventIds.has(eventId)) {
			return { code: 0, msg: 'duplicate' }
		}
		processedEventIds.add(eventId)
		if (processedEventIds.size > 1000) {
			const firstId = processedEventIds.values().next().value
			if (firstId) processedEventIds.delete(firstId)
		}
	}

	const actionPayload = parseActionPayload(readNested(root, [
		['action', 'value'],
		['event', 'action', 'value'],
		['event', 'actions', '0', 'value'],
	]))
	if (!actionPayload) {
		return { code: 0, msg: 'ignored' }
	}

	const openId = readNested(root, [
		['operator', 'open_id'],
		['event', 'operator', 'open_id'],
		['user', 'open_id'],
		['event', 'user', 'open_id'],
	])
	if (typeof openId !== 'string' || !openId) {
		return { code: 0, msg: 'missing operator' }
	}

	const actor = await prisma.doc_users.findFirst({
		where: { feishu_open_id: openId, status: 1, deleted_at: null },
		select: { id: true, name: true },
	})
	if (!actor) {
		return { code: 0, msg: 'operator not mapped' }
	}

	const openMessageId = readNested(root, [
		['open_message_id'],
		['message', 'open_message_id'],
		['event', 'open_message_id'],
	])
	const messageId = readNested(root, [
		['message_id'],
		['message', 'message_id'],
		['event', 'message_id'],
	])
	const openMessageIdStr = typeof openMessageId === 'string' ? openMessageId : null
	const messageIdStr = typeof messageId === 'string' ? messageId : null

	try {
		let result: { message: string; resultLabel: string }
		if (actionPayload.kind === 'ownership-transfer') {
			result = await executeOwnershipTransferAction({
				documentId: actionPayload.documentId,
				actor: { id: Number(actor.id), name: actor.name },
				action: actionPayload.intent === 'approve' ? 'accept' : 'reject',
			})
		} else if (actionPayload.kind === 'cross-move') {
			result = await executeCrossMoveAction({
				moveIds: actionPayload.moveIds,
				actor: { id: Number(actor.id), name: actor.name },
				action: actionPayload.intent,
			})
		} else {
			result = await executePermissionRequestAction({
				documentId: actionPayload.documentId,
				requestId: actionPayload.requestId,
				actor: { id: Number(actor.id), name: actor.name },
				action: actionPayload.intent,
			})
		}

		await updateFeishuCardResultByMessage({
			messageId: messageIdStr,
			openMessageId: openMessageIdStr,
			resultLabel: result.resultLabel,
		})

		return { code: 0, msg: result.message }
	} catch (err) {
		logger.warn({ err, actionPayload, actorId: String(actor.id) }, '处理飞书卡片动作失败')
		return {
			code: 0,
			msg: err instanceof Error ? err.message : 'action failed',
		}
	}
})
