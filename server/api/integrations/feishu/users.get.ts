/**
 * GET /api/integrations/feishu/users
 * 获取飞书用户列表（从 doc_feishu_users 表）
 *
 * Query:
 *   - status: 'normal' | 'hidden' | 'all' (默认 normal)
 *   - keyword: 搜索关键词（模糊匹配 nickname/email）
 */
import { prisma } from '~/server/utils/prisma'
import type { FeishuUserRow } from '~/server/types/feishu'

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const status = String(query.status || 'normal')
	const keyword = String(query.keyword || '').trim()

	let whereClause = '1=1'
	const params: unknown[] = []

	if (status !== 'all') {
		whereClause += ' AND f.status = ?'
		params.push(status)
	}

	if (keyword) {
		whereClause += ' AND (f.nickname LIKE ? OR f.email LIKE ?)'
		params.push(`%${keyword}%`, `%${keyword}%`)
	}

	const rows = await prisma.$queryRawUnsafe<FeishuUserRow[]>(
		`SELECT f.id, f.username, f.nickname, f.email, f.mobile, f.avatar,
				f.status, f.feishu_open_id, f.feishu_union_id, f.feishu_user_id,
				u.id AS linked_user_id, u.name AS linked_user_name
		 FROM doc_feishu_users f
		 LEFT JOIN doc_users u ON u.feishu_user_id = f.id AND u.deleted_at IS NULL
		 WHERE ${whereClause}
		 ORDER BY f.id`,
		...params,
	)

	return ok(rows.map(r => ({
		id: Number(r.id),
		username: r.username,
		nickname: r.nickname,
		email: r.email,
		mobile: r.mobile,
		avatar: r.avatar,
		status: r.status,
		feishuOpenId: r.feishu_open_id,
		feishuUnionId: r.feishu_union_id,
		feishuUserId: r.feishu_user_id,
		linkedUserId: r.linked_user_id ? Number(r.linked_user_id) : null,
		linkedUserName: r.linked_user_name,
	})))
})
