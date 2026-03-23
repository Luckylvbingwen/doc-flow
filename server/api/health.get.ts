export default defineEventHandler(() => {
  return {
    ok: true,
    service: 'docflow-api',
    time: new Date().toISOString()
  }
})
