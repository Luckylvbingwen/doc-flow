/**
 * 统一错误码常量
 * 所有 fail() 调用应引用此处的常量，避免魔法字符串散落各处
 *
 * 命名规范：{MODULE}_{DESCRIPTION}，全大写下划线分隔
 * HTTP 状态码映射关系仅作注释参考，实际由调用处传入
 */

// ─── 通用 ───
/** 无效请求参数 (400) */
export const INVALID_PARAMS = 'INVALID_PARAMS'
/** 资源未找到 (404) */
export const NOT_FOUND = 'NOT_FOUND'
/** 请求过于频繁 (429) */
export const RATE_LIMITED = 'RATE_LIMITED'

// ─── 认证（AUTH） ───
/** 未提供认证令牌 (401) */
export const AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING'
/** 认证令牌无效或已过期 (401) */
export const AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID'
/** 需要登录 (401) */
export const AUTH_REQUIRED = 'AUTH_REQUIRED'
/** 账号或密码错误 (401) */
export const AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS'
/** Refresh Token 无效或已吊销 (401) */
export const AUTH_REFRESH_INVALID = 'AUTH_REFRESH_INVALID'
/** 旧密码错误 (400) */
export const AUTH_OLD_PASSWORD_WRONG = 'AUTH_OLD_PASSWORD_WRONG'
/** 认证服务内部错误 (500) */
export const AUTH_INTERNAL_ERROR = 'AUTH_INTERNAL_ERROR'

// ─── 验证码 ───
/** 验证码校验失败 (400) */
export const CAPTCHA_INVALID = 'CAPTCHA_INVALID'

// ─── 权限（RBAC） ───
/** 无操作权限 (403) */
export const PERMISSION_DENIED = 'PERMISSION_DENIED'
/** 角色不存在 (404) */
export const ROLE_NOT_FOUND = 'ROLE_NOT_FOUND'
/** 角色标识已存在 (409) */
export const ROLE_CODE_EXISTS = 'ROLE_CODE_EXISTS'
/** 系统内置角色受保护 (400) */
export const SYSTEM_ROLE_PROTECTED = 'SYSTEM_ROLE_PROTECTED'
/** 用户不存在 (404) */
export const USER_NOT_FOUND = 'USER_NOT_FOUND'
/** 用户已拥有此角色 (409) */
export const ALREADY_ASSIGNED = 'ALREADY_ASSIGNED'

// ─── 飞书集成 ───
/** 飞书未配置 (500) */
export const FEISHU_NOT_CONFIGURED = 'FEISHU_NOT_CONFIGURED'
/** 飞书授权状态过期 (400) */
export const FEISHU_STATE_EXPIRED = 'STATE_EXPIRED'
/** 飞书用户标识为空 (400) */
export const FEISHU_USER_EMPTY = 'FEISHU_USER_EMPTY'
/** 飞书登录失败 (500) */
export const FEISHU_LOGIN_ERROR = 'FEISHU_LOGIN_ERROR'
/** 飞书消息发送失败 (500) */
export const FEISHU_SEND_ERROR = 'FEISHU_SEND_ERROR'
/** 飞书通讯录同步失败 (500) */
export const FEISHU_SYNC_ERROR = 'FEISHU_SYNC_ERROR'

// ─── 文档组 ───
/** 组不存在 (404) */
export const GROUP_NOT_FOUND = 'GROUP_NOT_FOUND'
/** 同级组名称已存在 (409) */
export const GROUP_NAME_EXISTS = 'GROUP_NAME_EXISTS'
/** 父组不存在 (400) */
export const PARENT_GROUP_NOT_FOUND = 'PARENT_GROUP_NOT_FOUND'
/** 组内含文档，无法删除 (400) */
export const GROUP_HAS_DOCUMENTS = 'GROUP_HAS_DOCUMENTS'
/** 组内含子组，无法删除 (400) */
export const GROUP_HAS_CHILDREN = 'GROUP_HAS_CHILDREN'

// ─── 产品线 ───
/** 产品线不存在 (404) */
export const PRODUCT_LINE_NOT_FOUND = 'PRODUCT_LINE_NOT_FOUND'
/** 产品线名称已存在 (409) */
export const PRODUCT_LINE_NAME_EXISTS = 'PRODUCT_LINE_NAME_EXISTS'
/** 产品线下含组，无法删除 (400) */
export const PRODUCT_LINE_HAS_GROUPS = 'PRODUCT_LINE_HAS_GROUPS'

// ─── 组成员 ───
/** 该成员不可修改/移除（组负责人或继承成员） (403) */
export const MEMBER_IMMUTABLE = 'MEMBER_IMMUTABLE'
/** 不可移除自己 (400) */
export const MEMBER_SELF_REMOVE = 'MEMBER_SELF_REMOVE'

// ─── 审批模板 ───
/** 开启审批时审批人不能为空 (400) */
export const APPROVAL_APPROVERS_REQUIRED = 'APPROVAL_APPROVERS_REQUIRED'
/** 审批人用户不存在或已停用 (400) */
export const APPROVAL_INVALID_APPROVER = 'APPROVAL_INVALID_APPROVER'

// ─── 审批实例 ───
/** 审批实例不存在 (404) */
export const APPROVAL_NOT_FOUND = 'APPROVAL_NOT_FOUND'
/** 仅发起人可撤回 (403) */
export const APPROVAL_NOT_INITIATOR = 'APPROVAL_NOT_INITIATOR'
/** 当前状态不可撤回（非"审批中"） (409) */
export const APPROVAL_NOT_WITHDRAWABLE = 'APPROVAL_NOT_WITHDRAWABLE'

// ─── 个人中心 ───
/** 草稿不存在 (404) */
export const DRAFT_NOT_FOUND = 'DRAFT_NOT_FOUND'
/** 仅归属人可删除草稿 (403) */
export const DRAFT_NOT_OWNER = 'DRAFT_NOT_OWNER'
/** 非草稿状态不可删除（仅草稿可删） (409) */
export const DRAFT_NOT_DELETABLE = 'DRAFT_NOT_DELETABLE'
/** 非部门负责人不可访问离职移交 (403) */
export const HANDOVER_NOT_DEPT_HEAD = 'HANDOVER_NOT_DEPT_HEAD'

// ─── 回收站 ───
/** 回收站项不存在或已被永久删除 (404) */
export const RECYCLE_NOT_FOUND = 'RECYCLE_NOT_FOUND'
/** 目标文档未处于已删除状态，不可恢复 (400) */
export const RECYCLE_NOT_DELETED = 'RECYCLE_NOT_DELETED'
/** 原组已被删除，无法恢复到原组 (400) */
export const RECYCLE_GROUP_MISSING = 'RECYCLE_GROUP_MISSING'
/** 恢复操作已过期（超 30 天） (400) */
export const RECYCLE_EXPIRED = 'RECYCLE_EXPIRED'

// ─── 系统管理（§6.9） ───
/** 系统管理员角色受保护，不可通过此接口变更 (403) */
export const ADMIN_SUPER_ADMIN_PROTECTED = 'ADMIN_SUPER_ADMIN_PROTECTED'
/** 取消产品线负责人前需先移除其名下产品线归属 (409) */
export const ADMIN_PL_HEAD_HAS_OWNERSHIP = 'ADMIN_PL_HEAD_HAS_OWNERSHIP'
/** 部门负责人由飞书同步，不可在此指派 (400) */
export const ADMIN_DEPT_HEAD_SYNC_ONLY = 'ADMIN_DEPT_HEAD_SYNC_ONLY'

// ─── 文档（document-core A 阶段） ───
/** 文档不存在 (404) */
export const DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND'
/** 文档当前状态不允许此操作 (409) */
export const DOCUMENT_STATUS_INVALID = 'DOCUMENT_STATUS_INVALID'
/** 组内已存在同名文档 (409) */
export const DOCUMENT_DUPLICATE_NAME = 'DOCUMENT_DUPLICATE_NAME'
/** 文档版本不存在 (404) */
export const VERSION_NOT_FOUND = 'VERSION_NOT_FOUND'

// ─── 文件上传 ───
/** 文件超出大小限制 (413) */
export const FILE_TOO_LARGE = 'FILE_TOO_LARGE'
/** 文件格式暂不支持（当前仅支持 .md，转换器尚未就绪） (400) */
export const FILE_FORMAT_UNSUPPORTED = 'FILE_FORMAT_UNSUPPORTED'
/** 文件转换失败（外部转换器异常） (500) */
export const FILE_CONVERT_FAILED = 'FILE_CONVERT_FAILED'

// ─── 对象存储 ───
/** 对象存储写入失败 (500) */
export const STORAGE_PUT_FAILED = 'STORAGE_PUT_FAILED'
/** 对象存储读取失败 (500) */
export const STORAGE_GET_FAILED = 'STORAGE_GET_FAILED'

// ─── 审批运行时 ───
/** 当前用户不是本节点的待处理审批人 (403) */
export const APPROVAL_NOT_APPROVER = 'APPROVAL_NOT_APPROVER'
/** 本节点已被处理，不可重复处理 (409) */
export const APPROVAL_ALREADY_ACTED = 'APPROVAL_ALREADY_ACTED'
/** 驳回意见为必填 (400) */
export const APPROVAL_REASON_REQUIRED = 'APPROVAL_REASON_REQUIRED'
/** 组未配置审批模板（但起审批接口要求有模板） (409) */
export const APPROVAL_NO_TEMPLATE = 'APPROVAL_NO_TEMPLATE'
