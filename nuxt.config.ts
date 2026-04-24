import { visualizer } from 'rollup-plugin-visualizer'

export default defineNuxtConfig({
  compatibilityDate: '2026-03-23',
  app: {
    pageTransition: { name: 'page-fade' },
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap',
        },
      ],
    },
  },
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
    },
    plugins: [
      // ANALYZE=true nuxt build 时生成 bundle 可视化报告
      ...(process.env.ANALYZE ? [
        visualizer({
          filename: './stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
        }),
      ] : []),
    ],
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
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
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
    // server/utils/extract.ts 通过 createRequire 按需加载这三个 CJS 包，
    // Rollup 静态分析看不到 require 调用，nft 默认不会把它们追加到 .output。
    // 显式 traceInclude 确保生产构建把依赖复制进 .output/server/node_modules。
    externals: {
      traceInclude: ['xlsx', 'mammoth', 'pdf-parse'],
    },
    scheduledTasks: {
      // 每天凌晨 2:00 自动同步飞书通讯录
      '0 2 * * *': ['feishu:sync-contacts'],
    },
    routeRules: {
      // 静态资源长缓存（Nuxt 构建产物自带 hash）
      '/_nuxt/**': {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
      // 健康检查接口短缓存，避免被高频探针压垮
      '/api/health': {
        cache: { maxAge: 10 },
      },
    }
  }
})
