import { z } from 'zod'

/* ── POST /api/rbac/roles ── */
export const roleCreateSchema = z.object({
	code: z.string()
		.min(1, '角色标识不能为空')
		.regex(/^[a-z][a-z0-9_]{1,48}$/, '角色标识仅允许小写字母、数字、下划线，2-49位'),
	name: z.string().min(1, '角色名称不能为空'),
	description: z.string().optional().default(''),
	status: z.union([z.literal(0), z.literal(1)]).optional().default(1),
})
export type RoleCreateBody = z.infer<typeof roleCreateSchema>

/* ── PUT /api/rbac/roles/:id ── */
export const roleUpdateSchema = z.object({
	name: z.string().min(1, '角色名称不能为空'),
	description: z.string().optional().default(''),
	status: z.union([z.literal(0), z.literal(1)]).optional().default(1),
})
export type RoleUpdateBody = z.infer<typeof roleUpdateSchema>

/* ── PUT /api/rbac/roles/:id/permissions ── */
export const rolePermissionsSchema = z.object({
	permissionIds: z.array(z.number().int().positive()),
})
export type RolePermissionsBody = z.infer<typeof rolePermissionsSchema>

/* ── POST /api/rbac/user-roles/assign ── */
export const userRoleAssignSchema = z.object({
	userId: z.number().int().positive('用户 ID 无效'),
	roleId: z.number().int().positive('角色 ID 无效'),
})
export type UserRoleAssignBody = z.infer<typeof userRoleAssignSchema>

/* ── POST /api/rbac/user-roles/revoke ── */
export const userRoleRevokeSchema = z.object({
	userId: z.number().int().positive('用户 ID 无效'),
	roleId: z.number().int().positive('角色 ID 无效'),
})
export type UserRoleRevokeBody = z.infer<typeof userRoleRevokeSchema>

/* ── GET /api/rbac/roles (query) ── */
export const roleListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
	keyword: z.string().optional().default(''),
})
export type RoleListQuery = z.infer<typeof roleListQuerySchema>

/* ── GET /api/rbac/user-roles (query) ── */
export const userRoleListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
	keyword: z.string().optional().default(''),
	roleId: z.coerce.number().int().optional(),
})
export type UserRoleListQuery = z.infer<typeof userRoleListQuerySchema>

/* ── GET /api/rbac/users (query) ── */
export const userSearchQuerySchema = z.object({
	keyword: z.string().optional().default(''),
})
export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>
