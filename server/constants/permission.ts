/**
 * 全栈统一的权限级别常量（PRD §4.2 / §4.3 / §6.3.4 / §6.3.7）
 *
 * 与 doc_group_members.role 对齐，4 值跨场景使用：
 *   1 管理员    — 仅 doc_group_members.role 出现（组级最高）
 *   2 可编辑    — group / 文档级权限自定义 / 分享 共用
 *   3 上传下载  — group / 文档级权限自定义 用
 *   4 可阅读    — 仅分享 ACL 用（doc_document_permissions 来自分享 / doc_share_links）
 *
 * 数值大小 = 权限大小，可直接做"权限不能超过当前用户自身"等比较（PRD §6.3.7 line 618）
 *
 * 各场景实际可取的子集：
 *   - 组成员管理：[1, 2, 3]
 *   - 文档级权限自定义弹窗（§6.3.4）：[2, 3]
 *   - 链接分享（§6.3.7）：[2, 4]
 */
export const PERMISSION_LEVEL = {
	ADMIN: 1,
	EDIT: 2,
	UPLOAD: 3,
	READ: 4,
} as const

export type PermissionLevelCode = typeof PERMISSION_LEVEL[keyof typeof PERMISSION_LEVEL]

/** 文档级权限自定义弹窗下拉可选项（§6.3.4） */
export const DOC_CUSTOM_PERMISSION_LEVELS = [PERMISSION_LEVEL.EDIT, PERMISSION_LEVEL.UPLOAD] as const

/** 链接分享可选项（§6.3.7） */
export const SHARE_PERMISSION_LEVELS = [PERMISSION_LEVEL.EDIT, PERMISSION_LEVEL.READ] as const

/** 组成员 role 可选项 */
export const GROUP_MEMBER_ROLES = [PERMISSION_LEVEL.ADMIN, PERMISSION_LEVEL.EDIT, PERMISSION_LEVEL.UPLOAD] as const

/** 中文标签（统一文案；前端 utils/permission-meta.ts 也用此口径） */
export const PERMISSION_LABEL: Record<PermissionLevelCode, string> = {
	[PERMISSION_LEVEL.ADMIN]: '管理员',
	[PERMISSION_LEVEL.EDIT]: '可编辑',
	[PERMISSION_LEVEL.UPLOAD]: '上传下载',
	[PERMISSION_LEVEL.READ]: '可阅读',
}
