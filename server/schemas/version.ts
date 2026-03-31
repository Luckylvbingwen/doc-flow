import { z } from 'zod'

/* ── GET /api/documents/[id]/versions ── */
export const versionListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type VersionListQuery = z.infer<typeof versionListQuerySchema>

/* ── POST /api/version/compare ── */
export const versionCompareSchema = z.object({
	documentId: z.number().int().positive(),
	fromVersionId: z.number().int().positive(),
	toVersionId: z.number().int().positive(),
})
export type VersionCompareBody = z.infer<typeof versionCompareSchema>
