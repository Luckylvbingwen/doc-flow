import { z } from 'zod'

/* ── POST /api/version/compare ── */
export const versionCompareSchema = z.object({
	fromVersion: z.number(),
	toVersion: z.number(),
})
export type VersionCompareBody = z.infer<typeof versionCompareSchema>
