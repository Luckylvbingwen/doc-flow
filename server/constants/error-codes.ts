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
