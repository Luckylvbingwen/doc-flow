import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { INVALID_PARAMS } from '~/server/constants/error-codes'

const querySchema = z.object({
	q: z.string().min(1).max(100).trim(),
})

interface GroupRow { id: bigint; name: string; description: string | null; scope_type: number }
interface DocRow { id: bigint; title: string; group_id: bigint; group_name: string; updated_at: Date; version_no: string | null }

export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, 'UNAUTHORIZED', '请先登录')

	let q: string
	try {
		const parsed = querySchema.parse(getQuery(event))
		q = parsed.q
	} catch {
		return fail(event, 400, INVALID_PARAMS, '请输入搜索关键词')
	}

	const keyword = `%${q}%`
	const userId = BigInt(user.id)

	const [groups, documents] = await Promise.all([
		prisma.$queryRaw<GroupRow[]>`
			SELECT id, name, description, scope_type
			FROM doc_groups
			WHERE id IN (
				SELECT group_id FROM doc_group_members WHERE user_id = ${userId} AND deleted_at IS NULL
			)
				AND name LIKE ${keyword}
				AND deleted_at IS NULL
			LIMIT 5
		`,
		prisma.$queryRaw<DocRow[]>`
			SELECT d.id, d.title, d.group_id, g.name AS group_name, d.updated_at, d.version_no
			FROM doc_documents d
			JOIN doc_groups g ON g.id = d.group_id
			WHERE d.group_id IN (
				SELECT group_id FROM doc_group_members WHERE user_id = ${userId} AND deleted_at IS NULL
			)
				AND d.title LIKE ${keyword}
				AND d.status = 4
				AND d.deleted_at IS NULL
			ORDER BY d.updated_at DESC
			LIMIT 10
		`,
	])

	return ok({
		groups: groups.map(g => ({
			id: Number(g.id),
			name: g.name,
			description: g.description,
			scopeType: g.scope_type,
		})),
		documents: documents.map(d => ({
			id: Number(d.id),
			title: d.title,
			groupId: Number(d.group_id),
			groupName: d.group_name,
			updatedAt: d.updated_at.getTime(),
			versionNo: d.version_no || null,
		})),
	})
})
