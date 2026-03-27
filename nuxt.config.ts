export default defineNuxtConfig({
  compatibilityDate: '2026-03-23',
  devtools: { enabled: process.env.APP_ENV !== 'production' },
  modules: ['@pinia/nuxt', '@element-plus/nuxt', '@nuxt/eslint', '@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'zh-CN', name: '中文' },
      { code: 'en-US', name: 'English' },
    ],
    defaultLocale: 'zh-CN',
    strategy: 'no_prefix',
    vueI18n: './i18n.config.ts',
    detectBrowserLanguage: false,
  },
  elementPlus: {
    importStyle: 'scss'
  },
  css: ['~/assets/styles/main.scss', '~/assets/styles/components.scss', '~/assets/styles/dark.scss'],
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/element-overrides.scss" as *;'
        }
      }
    }
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET || 'docflow-dev-secret-change-in-production!!',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    feishuAppId: process.env.FEISHU_APP_ID || '',
    feishuAppSecret: process.env.FEISHU_APP_SECRET || '',
    feishuWebhookUrl: process.env.FEISHU_WEBHOOK_URL,
    authDemoPassword: process.env.AUTH_DEMO_PASSWORD || 'Docflow@123',
    public: {
      appName: 'DocFlow',
      appEnv: process.env.APP_ENV || 'local',
      feishuAppId: process.env.FEISHU_APP_ID || '',
      feishuSiteUrl: process.env.FEISHU_SITE_URL || '',
    }
  },
  nitro: {
    experimental: {
      websocket: true
    },
    routeRules: {
      '/api/**': {
        cors: true
      }
    }
  }
})
