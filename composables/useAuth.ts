/**
 * 权限校验 composable
 *
 * 用法：
 *   const { can, hasRole } = useAuth()
 *   if (can('doc:create')) { ... }
 *   if (hasRole('admin')) { ... }
 */
export function useAuth() {
	const authStore = useAuthStore()

	/**
	 * 检查当前用户是否拥有指定权限
	 * @param permission 权限码或权限码数组
	 * @param mode 'any' = 满足任一即可(默认)，'all' = 必须全部满足
	 */
	function can(permission: string | string[], mode: 'any' | 'all' = 'any'): boolean {
		if (!authStore.isAuthenticated) return false

		// super_admin 拥有所有权限
		if (authStore.roles.some(r => r.code === 'super_admin')) return true

		const perms = Array.isArray(permission) ? permission : [permission]
		if (mode === 'all') {
			return perms.every(p => authStore.permissions.includes(p))
		}
		return perms.some(p => authStore.permissions.includes(p))
	}

	/**
	 * 检查当前用户是否拥有指定角色
	 * @param roleCode 角色码或角色码数组（任一匹配即可）
	 */
	function hasRole(roleCode: string | string[]): boolean {
		if (!authStore.isAuthenticated) return false
		const codes = Array.isArray(roleCode) ? roleCode : [roleCode]
		return codes.some(c => authStore.roles.some(r => r.code === c))
	}

	return { can, hasRole }
}
