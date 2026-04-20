/**
 * 系统角色常量（对齐 rbac.sql + PRD §4.1 / §6.9.2 角色定义表）
 *
 * 角色分两类：
 *   - 可指派类：super_admin / company_admin / pl_head（admin 页面可操作）
 *   - 飞书同步类：dept_head（只读展示，不可在此页指派）
 *
 * `sortWeight` 用于系统管理页列表排序 — 系统管理员 → 公司层 → 产品线 → 部门 → 无
 */

/** 可选系统角色 code（与 sys_roles.code 一致） */
export const SYSTEM_ROLE_CODES = {
	SUPER_ADMIN: 'super_admin',
	COMPANY_ADMIN: 'company_admin',
	PL_HEAD: 'pl_head',
	DEPT_HEAD: 'dept_head',
} as const

export type SystemRoleCode = typeof SYSTEM_ROLE_CODES[keyof typeof SYSTEM_ROLE_CODES]

/** admin 页面指派弹窗可操作的角色（PRD §6.9.2 —— 两张卡片：company_admin / pl_head） */
export const ASSIGNABLE_ROLE_CODES: readonly SystemRoleCode[] = [
	SYSTEM_ROLE_CODES.COMPANY_ADMIN,
	SYSTEM_ROLE_CODES.PL_HEAD,
]

/** 角色展示元数据（中文名 + 排序权重） */
export const SYSTEM_ROLE_META: Record<SystemRoleCode, { name: string; sortWeight: number }> = {
	super_admin: { name: '系统管理员', sortWeight: 1 },
	company_admin: { name: '公司层管理员', sortWeight: 2 },
	pl_head: { name: '产品线负责人', sortWeight: 3 },
	dept_head: { name: '部门负责人', sortWeight: 4 },
}

/** 用户状态（doc_users.status） */
export const USER_STATUS = {
	/** 活跃 */
	ACTIVE: 1,
	/** 已停用 */
	DEACTIVATED: 0,
} as const

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS]

/** admin 页列表筛选：用户状态 */
export const USER_STATUS_FILTER = {
	ALL: 'all',
	ACTIVE: 'active',
	DEACTIVATED: 'deactivated',
} as const

export type UserStatusFilter = typeof USER_STATUS_FILTER[keyof typeof USER_STATUS_FILTER]

/** 角色筛选：允许的筛选项（包括"无系统角色"） */
export const ROLE_FILTER_CODES = [
	SYSTEM_ROLE_CODES.SUPER_ADMIN,
	SYSTEM_ROLE_CODES.COMPANY_ADMIN,
	SYSTEM_ROLE_CODES.PL_HEAD,
	SYSTEM_ROLE_CODES.DEPT_HEAD,
	'none', // 无任何系统角色
] as const

export type RoleFilterCode = typeof ROLE_FILTER_CODES[number]

/** sys_user_roles.scope_type */
export const SCOPE_TYPE = {
	DEPARTMENT: 1,
	PRODUCT_LINE: 2,
} as const
