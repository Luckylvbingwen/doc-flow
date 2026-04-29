/**
 * 回收站数据范围过滤工具
 *
 * PRD 确认：回收站“自己看自己的”，每个用户只能看到自己删除的文档，不分角色差异。
 *
 * 使用：buildRecycleScopeFilter(userId) 返回 Prisma.Sql，
 *       直接拼接到 WHERE 子句中（依赖别名 d = doc_documents）
 */
import { Prisma } from '@prisma/client'

export async function buildRecycleScopeFilter(userId: number): Promise<Prisma.Sql> {
	return Prisma.sql`d.deleted_by_user_id = ${userId}`
}
