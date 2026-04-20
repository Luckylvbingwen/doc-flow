/**
 * 系统管理（§6.9）Zod schema
 */
import { z } from 'zod'
import {
	SYSTEM_ROLE_CODES, ROLE_FILTER_CODES, USER_STATUS_FILTER,
} from '~/server/constants/system-roles'

/** 用户列表查询参数 */
export const adminUserListQuerySchema = z.object({
	keyword: z.string().trim().max(100).optional(),
	/** 支持多选：多角色 or 'none'（无角色） */
	roles: z.preprocess(
		v => (typeof v === 'string' && v.length > 0 ? v.split(',') : v),
		z.array(z.enum(ROLE_FILTER_CODES as unknown as [string, ...string[]])).optional(),
	),
	status: z.enum([USER_STATUS_FILTER.ALL, USER_STATUS_FILTER.ACTIVE, USER_STATUS_FILTER.DEACTIVATED])
		.default(USER_STATUS_FILTER.ALL),
	page: z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>

/** 角色指派请求体
 *
 * 约束：
 *   - companyAdmin：是否具备公司层管理员身份
 *   - plHead：是否具备产品线负责人身份（取消时若仍负责产品线，会被后端拒绝）
 *
 * 本接口不处理 super_admin（受保护） 和 dept_head（飞书同步）
 */
export const adminRoleAssignBodySchema = z.object({
	companyAdmin: z.boolean(),
	plHead: z.boolean(),
})

export type AdminRoleAssignBody = z.infer<typeof adminRoleAssignBodySchema>

/** 重导出角色 code 便于 handler 引用 */
export { SYSTEM_ROLE_CODES }
