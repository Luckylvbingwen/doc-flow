/** 文档导航树 — 类型定义 */

/** 树文件节点 */
export interface NavTreeFile {
	id: number
	name: string
	/** 文件类型/扩展名, e.g. 'pdf','md','doc' */
	type: string
}

/** 树组节点（递归） */
export interface NavTreeGroup {
	id: number
	name: string
	/** 后代文件总数（可选，用于显示 badge） */
	fileCount?: number
	/** 子组 */
	children?: NavTreeGroup[]
	/** 组内已发布文件（仅 nav 模式用） */
	files?: NavTreeFile[]
	/** 负责人 */
	owner?: string
	/** 描述 */
	desc?: string
}

/** 树分类节点（顶层分类：公司层 / 按部门 / 按产品线） */
export interface NavTreeCategory {
	id: string
	label: string
	scope: 'company' | 'department' | 'productline'
	/** 分类 badge（下属数量） */
	badge?: number
	/**
	 * - company: 直接包含 groups
	 * - department / productline: 包含 orgUnits
	 */
	groups?: NavTreeGroup[]
	orgUnits?: NavTreeOrgUnit[]
}

/** 中间层节点（部门名 / 产品线名） */
export interface NavTreeOrgUnit {
	id: string
	label: string
	badge?: number
	groups: NavTreeGroup[]
}

/** DocNavTree 组件 props - mode */
export type NavTreeMode = 'nav' | 'picker'
