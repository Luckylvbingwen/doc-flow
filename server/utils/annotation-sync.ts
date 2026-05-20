import type { WsAnnotationItem, WsAnnotationReply } from '~/types/ws'
import { prisma } from '~/server/utils/prisma'

export async function getAnnotationSyncItem(
	documentId: bigint,
	annotationId: bigint,
	currentVersionId: bigint | null,
): Promise<WsAnnotationItem | null> {
	const ann = await prisma.doc_document_annotations.findFirst({
		where: { id: annotationId, document_id: documentId, deleted_at: null },
		include: {
			doc_users: { select: { name: true, avatar_url: true } },
			doc_annotation_replies: {
				where: { deleted_at: null },
				orderBy: { created_at: 'asc' },
				include: { doc_users: { select: { name: true, avatar_url: true } } },
			},
		},
	})
	if (!ann) return null

	return {
		id: ann.id.toString(),
		content: ann.content,
		quoteText: ann.quote_text ?? '',
		anchorData: ann.anchor_data as Record<string, unknown>,
		authorName: ann.doc_users?.name ?? '',
		authorAvatar: ann.doc_users?.avatar_url ?? null,
		createdAt: ann.created_at.getTime(),
		status: ann.status,
		resolvedAt: ann.resolved_at ? ann.resolved_at.getTime() : null,
		frozen: ann.is_frozen === 1 || (ann.version_id !== null && currentVersionId !== null && ann.version_id !== currentVersionId),
		replies: ann.doc_annotation_replies.map<WsAnnotationReply>(rp => ({
			id: rp.id.toString(),
			content: rp.content,
			authorName: rp.doc_users?.name ?? '',
			authorAvatar: rp.doc_users?.avatar_url ?? null,
			createdAt: rp.created_at.getTime(),
		})),
	}
}
