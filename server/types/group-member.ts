/**
 * 组成员模块 — 服务端 DB 行类型
 */

/** 成员列表查询行 */
export interface MemberRow {
	id: bigint | number
	user_id: bigint | number
	name: string
	email: string | null
	avatar_url: string | null
	role: number
	source_type: number
	immutable_flag: number
	joined_at: Date
}

/** 成员校验行（修改/删除前校验） */
export interface MemberCheckRow {
	id: bigint | number
	user_id: bigint | number
	immutable_flag: number
}

/** 部门行（用户树构建） */
export interface UserTreeDeptRow {
	id: bigint | number
	name: string
	feishu_department_id: string | null
}

/** 飞书用户行（用户树构建） */
export interface UserTreeUserRow {
	user_id: bigint | number
	name: string
	email: string | null
	avatar_url: string | null
	feishu_department_ids: string | string[] | null
}

/** 已加入成员 user_id 集合查询行 */
export interface JoinedUserRow {
	user_id: bigint | number
}
