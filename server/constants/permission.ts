/**
 * 服务端入口：从 utils/permission-meta.ts 重导出全栈共享的权限常量
 * 不在此处再次定义，避免双源不同步
 */
export {
	PERMISSION_LEVEL,
	type PermissionLevel as PermissionLevelType,
	type PermissionLevelCode,
	DOC_CUSTOM_PERMISSION_LEVELS,
	SHARE_PERMISSION_LEVELS,
	GROUP_MEMBER_ROLES,
	PERMISSION_LABEL,
} from '~/utils/permission-meta'
