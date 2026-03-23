export default defineEventHandler(async (event) => {
  const body = await readBody<{ fromVersion: number; toVersion: number }>(event)

  return {
    ok: true,
    fromVersion: body?.fromVersion ?? null,
    toVersion: body?.toVersion ?? null,
    summary: 'Version compare endpoint placeholder'
  }
})
