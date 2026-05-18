/**
 * 批注冻结工具
 *
 * 当文档发布新版本（current_version_id 变更）时，
 * 将属于旧版本的批注永久标记为 is_frozen=1（不可逆）。
 */
import { prisma } from '~/server/utils/prisma'
import type { Prisma } from '@prisma/client'

/**
 * 冻结文档旧版本的批注（不可逆）
 *
 * @param documentId 文档 ID
 * @param newVersionId 新的 current_version_id
 * @param tx 可选事务客户端（在事务内调用时传入）
 */
export async function freezeOldAnnotations(
	documentId: bigint,
	newVersionId: bigint,
	tx?: Prisma.TransactionClient,
) {
	const client = tx || prisma
	await client.doc_document_annotations.updateMany({
		where: {
			document_id: documentId,
			version_id: { not: newVersionId },
			is_frozen: 0,
			deleted_at: null,
		},
		data: { is_frozen: 1 },
	})
}
