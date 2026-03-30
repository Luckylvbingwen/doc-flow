import { versionCompareSchema } from '~/server/schemas/version'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, versionCompareSchema.parse)

	return {
		ok: true,
		fromVersion: body.fromVersion,
		toVersion: body.toVersion,
		summary: 'Version compare endpoint placeholder'
	}
})
