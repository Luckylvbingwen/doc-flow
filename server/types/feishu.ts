/**
 * 飞书集成模块 — 服务端类型
 */

/** 飞书用户列表查询行（doc_feishu_users JOIN doc_users） */
export interface FeishuUserRow {
	id: number | bigint
	username: string
	nickname: string
	email: string | null
	mobile: string | null
	avatar: string | null
	status: string
	feishu_open_id: string
	feishu_union_id: string
	feishu_user_id: string
	linked_user_id: number | bigint | null
	linked_user_name: string | null
}

/** 飞书消息通知请求体 */
export interface NotifyBody {
	openId?: string
	msgType?: 'text' | 'card'
	text?: string
	card?: Record<string, unknown>
}

/** 飞书 API 通用响应 */
export interface FeishuApiResponse {
	code: number
	msg: string
	data?: Record<string, unknown>
}

/** 飞书部门 */
export interface FeishuDept {
	open_department_id: string
	department_id?: string
	name?: string
	/** 部门主管的 user_id（飞书开放平台字段） */
	leader_user_id?: string
}

/** 飞书通讯录用户 */
export interface FeishuContactUser {
	user_id: string
	open_id: string
	union_id: string
	name: string
	en_name?: string
	email?: string
	mobile?: string
	avatar?: { avatar_origin?: string; avatar_240?: string }
	department_ids?: string[]
	status?: {
		is_activated?: boolean
		is_resigned?: boolean
		is_frozen?: boolean
	}
}

/** 飞书 OAuth token 响应 */
export interface FeishuOAuthTokenResponse {
	code: number
	msg: string
	data: {
		access_token: string
		token_type: string
		expires_in: number
		refresh_token: string
	}
}

/** 飞书用户信息响应 */
export interface FeishuUserInfoResponse {
	code: number
	msg: string
	data: {
		open_id: string
		union_id: string
		user_id: string
		name: string
		avatar_url: string
		email?: string
		mobile?: string
	}
}

/** 通讯录同步结果 */
export interface FeishuSyncResult {
	/** 飞书拉取到的用户总数 */
	total: number
	/** 飞书拉取到的部门数 */
	departments: number
	/** doc_feishu_users 新建 */
	created: number
	/** doc_feishu_users 更新 */
	updated: number
	/** doc_feishu_users 因飞书侧已不存在被标记 hidden */
	hidden: number
	/** doc_departments 新建 */
	deptCreated: number
	/** doc_departments 更新 */
	deptUpdated: number
	/** doc_users 新建（§327 全员预落地） */
	docUserCreated: number
	/** doc_users 更新 */
	docUserUpdated: number
	/** 指派 dept_head 角色数 */
	deptHeadAssigned: number
}
