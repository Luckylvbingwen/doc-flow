export default defineNuxtConfig({
  compatibilityDate: '2026-03-23',
  devtools: { enabled: process.env.APP_ENV !== 'production' },
  modules: ['@pinia/nuxt', '@element-plus/nuxt', '@nuxt/eslint', '@nuxtjs/i18n', 'nuxt-security'],
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
    redisUrl: process.env.REDIS_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'docflow-dev-secret-change-in-production!!',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
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
  security: {
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", 'wss:', 'ws:'],
      },
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
      },
    },
    corsHandler: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
        : (process.env.APP_ENV === 'production' ? [] : ['*']),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    },
    rateLimiter: false, // 使用 rate-limiter-flexible 自行管理
  },
  nitro: {
    experimental: {
      websocket: true,
      tasks: true,
    },
    scheduledTasks: {
      // 每天凌晨 2:00 自动同步飞书通讯录
      '0 2 * * *': ['feishu:sync-contacts'],
    },
    routeRules: {}
  }
})
