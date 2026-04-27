/**
 * 全栈统一的权限常量 + 徽章 UI meta（前/后端共享）
 *
 * 数值含义：1管理员 / 2可编辑 / 3上传下载 / 4可阅读
 * 数值大小 = 权限大小，可直接做"权限不能超过当前用户自身"等比较（PRD §6.3.7）
 *
 * 各场景实际取值子集：
 *   - 组成员管理：[1, 2, 3]
 *   - 文档级权限自定义弹窗（§6.3.4）：[2, 3]
 *   - 链接分享（§6.3.7）：[2, 4]
 *
 * 服务端通过 server/constants/permission.ts 重导出本文件
 */

export const PERMISSION_LEVEL = {
	ADMIN: 1,
	EDIT: 2,
	UPLOAD: 3,
	READ: 4,
} as const

export type PermissionLevel = 1 | 2 | 3 | 4
export type PermissionLevelCode = typeof PERMISSION_LEVEL[keyof typeof PERMISSION_LEVEL]

/** 文档级权限自定义弹窗下拉可选项（§6.3.4） */
export const DOC_CUSTOM_PERMISSION_LEVELS = [PERMISSION_LEVEL.EDIT, PERMISSION_LEVEL.UPLOAD] as const

/** 链接分享可选项（§6.3.7） */
export const SHARE_PERMISSION_LEVELS = [PERMISSION_LEVEL.EDIT, PERMISSION_LEVEL.READ] as const

/** 组成员 role 可选项 */
export const GROUP_MEMBER_ROLES = [PERMISSION_LEVEL.ADMIN, PERMISSION_LEVEL.EDIT, PERMISSION_LEVEL.UPLOAD] as const

/** 中文标签（统一文案） */
export const PERMISSION_LABEL: Record<PermissionLevel, string> = {
	1: '管理员',
	2: '可编辑',
	3: '上传下载',
	4: '可阅读',
}

export interface PermissionBadge {
	label: string
	color: string
	bg: string
}

export const PERMISSION_META: Record<PermissionLevel, PermissionBadge> = {
	1: { label: '管理员', color: '#b91c1c', bg: '#fee2e2' },  // 红
	2: { label: '可编辑', color: '#1d4ed8', bg: '#dbeafe' },  // 蓝
	3: { label: '上传下载', color: '#a16207', bg: '#fef3c7' },  // 琥珀
	4: { label: '可阅读', color: '#6b7280', bg: '#f3f4f6' },  // 中性灰
}

export function getPermissionMeta(lv: PermissionLevel | null | undefined): PermissionBadge {
	if (lv == null) return { label: '', color: '#6b7280', bg: '#f3f4f6' }
	return PERMISSION_META[lv] ?? { label: '', color: '#6b7280', bg: '#f3f4f6' }
}

/** 文档级权限自定义弹窗下拉可选项（PRD §6.3.4：可编辑 / 上传下载） */
export const DOC_CUSTOM_PERMISSION_OPTIONS: Array<{ value: 2 | 3; label: string }> = [
	{ value: 2, label: PERMISSION_META[2].label },
	{ value: 3, label: PERMISSION_META[3].label },
]
