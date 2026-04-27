/** 路径段 → 面包屑标签映射 */
const LABEL_MAP: Record<string, string> = {
	docs: '共享文档',
	approvals: '审批中心',
	logs: '操作日志',
	'recycle-bin': '回收站',
	notifications: '通知中心',
	admin: '系统管理',
	profile: '个人中心',
	file: '文件详情',
}

export interface BreadcrumbItem {
	label: string
	to?: string
}

export function useBreadcrumb() {
	const route = useRoute()

	const breadcrumbs = computed<BreadcrumbItem[]>(() => {
		const segments = route.path.split('/').filter(Boolean)
		const items: BreadcrumbItem[] = []
		let path = ''

		for (let i = 0; i < segments.length; i++) {
			const seg = segments[i]
			path += `/${seg}`
			const label = LABEL_MAP[seg]

			// 跳过无标签的段（未知路径或动态参数如 id）
			if (!label) continue

			const isLast = i === segments.length - 1
				|| (i === segments.length - 2 && !LABEL_MAP[segments[i + 1]])

			items.push({
				label,
				to: isLast ? undefined : path,
			})
		}

		return items
	})

	return { breadcrumbs }
}
