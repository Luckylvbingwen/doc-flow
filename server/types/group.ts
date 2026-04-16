/**
 * 文档组模块 — 服务端 DB 行类型
 */

/** 组查询行（树构建用） */
export interface GroupTreeRow {
	id: bigint | number
	parent_id: bigint | number | null
	scope_type: number
	scope_ref_id: bigint | number | null
	name: string
	description: string | null
	owner_user_id: bigint | number
	owner_name: string
	approval_enabled: number
	file_size_limit_mb: number
	status: number
	file_count: bigint | number
}

/** 组详情查询行 */
export interface GroupDetailRow {
	id: bigint | number
	parent_id: bigint | number | null
	scope_type: number
	scope_ref_id: bigint | number | null
	name: string
	description: string | null
	owner_user_id: bigint | number
	owner_name: string
	approval_enabled: number
	file_size_limit_mb: number
	allowed_file_types: string | null
	file_name_regex: string | null
	status: number
	file_count: bigint | number
	created_by: bigint | number
	created_at: Date
	updated_at: Date
}

/** 组校验行（编辑/删除前校验） */
export interface GroupCheckRow {
	id: bigint | number
	scope_type: number
	scope_ref_id: bigint | number | null
	owner_user_id: bigint | number
}

/** 部门查询行 */
export interface DepartmentRow {
	id: bigint | number
	name: string
	owner_user_id: bigint | number | null
	owner_name: string | null
}

/** 产品线查询行 */
export interface ProductLineRow {
	id: bigint | number
	name: string
	description: string | null
	owner_user_id: bigint | number | null
	owner_name: string | null
	status: number
	group_count: bigint | number
	created_at: Date
}

/** 产品线校验行 */
export interface ProductLineCheckRow {
	id: bigint | number
	owner_user_id: bigint | number | null
}

/** 存在性计数行 */
export interface CountRow {
	cnt: bigint | number
}
