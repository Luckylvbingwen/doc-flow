export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = await readBody<Record<string, unknown>>(event)

  if (!config.feishuWebhookUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'FEISHU_WEBHOOK_URL is not configured'
    })
  }

  return {
    ok: true,
    message: 'Feishu webhook placeholder',
    payloadPreview: body
  }
})
