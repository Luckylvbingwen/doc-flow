/**
 * 系统角色 UI 元数据（§6.9.2）
 *
 * 色值对齐原型 v21：
 *   - 系统管理员：红色（danger-light 底 + danger 字）
 *   - 公司层管理员：黄色（#fef3c7 + #92400e）
 *   - 产品线负责人：靛蓝色（#e0e7ff + #4338ca）
 *   - 部门负责人：蓝色半透明（primary-light + primary），带「飞书」小标签
 */
import type { AdminSystemRoleCode } from '~/types/admin'

export interface RoleBadgeMeta {
	label: string
	color: string
	bg: string
	/** 是否飞书同步（badge 带半透明 + 「飞书」小标签） */
	feishuSynced?: boolean
}

export const SYSTEM_ROLE_META: Record<AdminSystemRoleCode, RoleBadgeMeta> = {
	super_admin: {
		label: '系统管理员',
		color: '#b91c1c',
		bg: '#fee2e2',
	},
	company_admin: {
		label: '公司层管理员',
		color: '#92400e',
		bg: '#fef3c7',
	},
	pl_head: {
		label: '产品线负责人',
		color: '#4338ca',
		bg: '#e0e7ff',
	},
	dept_head: {
		label: '部门负责人',
		color: '#1d4ed8',
		bg: '#dbeafe',
		feishuSynced: true,
	},
}

export function getRoleMeta(code: AdminSystemRoleCode): RoleBadgeMeta {
	return SYSTEM_ROLE_META[code] ?? { label: code, color: '#6b7280', bg: '#f3f4f6' }
}

/** 筛选下拉选项（系统角色 + '无系统角色'） */
export const ROLE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: 'super_admin', label: '系统管理员' },
	{ value: 'company_admin', label: '公司层管理员' },
	{ value: 'pl_head', label: '产品线负责人' },
	{ value: 'dept_head', label: '部门负责人' },
	{ value: 'none', label: '无系统角色' },
]

/** 状态筛选下拉选项 */
export const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | 'active' | 'deactivated'; label: string }> = [
	{ value: 'all', label: '全部' },
	{ value: 'active', label: '活跃' },
	{ value: 'deactivated', label: '已停用' },
]
