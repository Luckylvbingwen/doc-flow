import { z } from 'zod'

/**
 * GET /api/documents 列表查询
 *
 * 默认 status=4 已发布，对应 PRD §6.3.3 仓库详情文件列表
 */
export const documentListQuerySchema = z.object({
	groupId:  z.coerce.number().int().positive(),
	status:   z.coerce.number().int().min(1).max(6).optional().default(4),
	keyword:  z.string().trim().max(100).optional(),
	page:     z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>

/**
 * POST /api/documents/upload 首次上传（multipart）表单字段
 *
 * 文件本身通过 readMultipartFormData 取，不走 Zod；Zod 只校验附带的 form 字段。
 */
export const documentUploadFieldsSchema = z.object({
	groupId:    z.coerce.number().int().positive(),
	title:      z.string().trim().min(1).max(255).optional(),
	changeNote: z.string().trim().max(500).optional(),
})
export type DocumentUploadFields = z.infer<typeof documentUploadFieldsSchema>

/**
 * POST /api/documents/:id/versions 更新版本（multipart）表单字段
 *
 * 相比 upload：无 groupId（从文档推）、无 title（复用原标题）
 */
export const documentVersionUploadFieldsSchema = z.object({
	changeNote: z.string().trim().max(500).optional(),
})
export type DocumentVersionUploadFields = z.infer<typeof documentVersionUploadFieldsSchema>

/** GET /api/documents/:id/download 查询参数 */
export const documentDownloadQuerySchema = z.object({
	versionId: z.coerce.number().int().positive().optional(),
})
export type DocumentDownloadQuery = z.infer<typeof documentDownloadQuerySchema>

/** GET /api/documents/:id/preview 查询参数 */
export const documentPreviewQuerySchema = z.object({
	versionId: z.coerce.number().int().positive().optional(),
})
export type DocumentPreviewQuery = z.infer<typeof documentPreviewQuerySchema>
