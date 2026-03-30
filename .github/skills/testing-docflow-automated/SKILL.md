---
name: testing-docflow-automated
description: 为 DocFlow 编写和执行自动化测试（单元/API/组件/E2E），基于 Vitest + @vue/test-utils + Playwright，利用 Zod schema 实现 FE/BE/DB 闭环验证。
---

# DocFlow 自动化测试

## 适用场景

- 为已有功能补充自动化测试。
- 新增功能时同步编写测试。
- 重构后验证行为不变。
- CI 集成回归测试。

## 技术栈

| 测试层 | 工具 | 目标 |
|---|---|---|
| **单元测试** | Vitest | composables、utils、stores、schema 校验 |
| **API 集成测试** | Vitest + readValidatedBody | server/api/ handler 逻辑 + 参数校验 |
| **组件测试** | Vitest + @vue/test-utils + @nuxt/test-utils | Vue 组件渲染、交互、状态 |
| **E2E 测试** | Playwright | 完整用户流程 |

## 目录结构约定

```
tests/
├── unit/                    # 单元测试
│   ├── schemas/             # zod schema 校验测试
│   │   ├── auth.test.ts
│   │   ├── rbac.test.ts
│   │   └── integration.test.ts
│   ├── utils/               # 工具函数测试
│   │   ├── format.test.ts
│   │   └── response.test.ts
│   └── stores/              # Pinia store 测试
│       └── auth.test.ts
├── api/                     # API handler 集成测试
│   ├── auth/
│   │   ├── login.test.ts
│   │   └── captcha.test.ts
│   └── rbac/
│       ├── roles.test.ts
│       └── user-roles.test.ts
├── components/              # 组件测试
│   ├── DataTable.test.ts
│   └── Modal.test.ts
├── e2e/                     # E2E 测试
│   ├── login.spec.ts
│   └── rbac.spec.ts
└── helpers/                 # 测试工具
    ├── mock-prisma.ts       # Prisma mock
    ├── mock-auth.ts         # Auth context mock
    └── factories.ts         # 测试数据工厂
```

## 命名约定

- 单元/API/组件测试：`*.test.ts`
- E2E 测试：`*.spec.ts`
- 测试辅助：不带 `.test.` 或 `.spec.`

## 闭环验证模式

DocFlow 使用 Zod schema 作为 FE/BE 共享契约层（`server/schemas/`）。测试闭环依赖以下关系：

```
server/schemas/*.ts  ←── Single Source of Truth
        │
        ├──→ API handler 用 readValidatedBody(event, schema.parse) 做运行时校验
        │        → API 测试用同一 schema 验证非法参数被拒绝
        │
        ├──→ FE api/*.ts 用 z.infer<typeof schema> 推导请求类型
        │        → 组件测试用 schema 生成 mock 数据，保证格式一致
        │
        └──→ tests/unit/schemas/ 直接测试 schema 本身
                 → 确保业务规则（正则、范围、必填）符合预期
```

### Schema 测试模式

```ts
import { loginBodySchema } from '~/server/schemas/auth'

describe('loginBodySchema', () => {
  it('接受合法参数', () => {
    const result = loginBodySchema.safeParse({
      account: 'admin@docflow.local',
      password: 'Docflow@123',
      captchaClicks: [{ x: 100, y: 200 }],
      captchaToken: 'abc123',
    })
    expect(result.success).toBe(true)
  })

  it('拒绝空账号', () => {
    const result = loginBodySchema.safeParse({
      account: '',
      password: 'Docflow@123',
      captchaClicks: [],
      captchaToken: 'abc',
    })
    expect(result.success).toBe(false)
  })
})
```

### API Handler 测试模式

```ts
// 直接调用 handler 函数，mock Prisma 和 event
import { describe, it, expect, vi } from 'vitest'

// mock prisma
vi.mock('~/server/utils/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  }
}))

// 构造 H3 event（用 h3 的 createEvent）
import { createEvent } from 'h3'

describe('POST /api/rbac/roles', () => {
  it('校验 code 格式不合法时返回 400', async () => {
    // readValidatedBody 会抛出 ZodError → H3 自动返回 400
    // 测试确认非法 body 时 handler 不会到达业务逻辑
  })
})
```

### 组件测试模式

```ts
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'

describe('RoleManager', () => {
  it('创建角色表单提交正确的 body', async () => {
    const wrapper = mount(RoleManager, {
      global: {
        plugins: [createTestingPinia()],
      },
    })
    // ...交互后断言 apiCreateRole 被调用时的参数
    // 参数须符合 roleCreateSchema
  })
})
```

### E2E 测试模式

```ts
import { test, expect } from '@playwright/test'

test('登录 → 进入文档列表', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid="account"]', 'admin@docflow.local')
  await page.fill('[data-testid="password"]', 'Docflow@123')
  // ...完成验证码 → 点击登录
  await expect(page).toHaveURL('/docs')
})
```

## 执行步骤

1. **确认测试框架已安装**：检查 `vitest`、`@vue/test-utils`、`@nuxt/test-utils`、`@pinia/testing`、`playwright` 依赖。
2. **确认 schema 层已就绪**：`server/schemas/` 下的 zod schema 是所有测试断言的基础。
3. **编写 schema 测试**：为每个 schema 覆盖正常值、边界值、非法值。
4. **编写 API 测试**：mock Prisma，验证 handler 对合法/非法参数的处理。
5. **编写组件测试**：mock store 和 API 层，验证渲染和交互。
6. **编写 E2E 测试**：针对核心用户流程（登录、RBAC 管理）。
7. **配置 CI**：GitHub Actions 中运行 `npm run test` 和 `npm run test:e2e`。

## 输出格式

- 测试文件放在 `tests/` 对应子目录。
- 配置文件：`vitest.config.ts`、`playwright.config.ts`。
- package.json scripts：`test`、`test:unit`、`test:api`、`test:e2e`、`test:coverage`。

## Mock 策略

| 依赖 | Mock 方式 | 说明 |
|---|---|---|
| Prisma | `vi.mock('~/server/utils/prisma')` | 替换 `$queryRaw` / `$executeRaw` 返回值 |
| Auth context | 构造 `event.context.user` | 模拟已登录用户 |
| useAuthFetch | `vi.mock('~/composables/useAuthFetch')` | 控制 API 返回值 |
| Pinia stores | `@pinia/testing` 的 `createTestingPinia` | 注入初始状态 |
| 路由 | `@nuxt/test-utils` 的 `mockNuxtImport` | mock `useRoute`、`navigateTo` |

## Script 约定

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run tests/unit",
  "test:api": "vitest run tests/api",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test"
}
```

## 中文调用示例

```text
用 testing-docflow-automated 为登录接口编写测试。

范围：
- Schema：server/schemas/auth.ts 的 loginBodySchema
- Handler：server/api/auth/login.post.ts
- 组件：pages/login.vue 的表单提交

输出：
- tests/unit/schemas/auth.test.ts
- tests/api/auth/login.test.ts
```
