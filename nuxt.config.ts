export default defineNuxtConfig({
  compatibilityDate: '2026-03-23',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@element-plus/nuxt'],
  css: ['~/assets/styles/main.scss', '~/assets/styles/dark.scss'],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    feishuWebhookUrl: process.env.FEISHU_WEBHOOK_URL,
    authDemoPassword: process.env.AUTH_DEMO_PASSWORD || 'Docflow@123',
    public: {
      appName: 'DocFlow',
      appEnv: process.env.APP_ENV || 'local'
    }
  },
  nitro: {
    routeRules: {
      '/api/**': {
        cors: true
      }
    }
  }
})
