# Graphite Dual-tone Visual Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current indigo/aurora visual theme with a professional Graphite Dual-tone design system — dark sidebar, blue accent, reduced border radius, distinctive typography — establishing a themeable foundation for framework reuse.

**Architecture:** CSS-variable-first approach. All color/radius/font changes flow through `:root` and `html.dark` variable definitions. The sidebar gets a permanent dark treatment via new `--df-sidebar-*` variables. The login page is completely restyled to match the graphite aesthetic. Hardcoded colors throughout components are replaced with CSS variables or the new palette.

**Tech Stack:** SCSS, CSS Custom Properties, Google Fonts (Plus Jakarta Sans), Nuxt 3, Element Plus SCSS theming.

---

### Task 1: Update CSS variable foundations in main.scss

**Files:**
- Modify: `assets/styles/main.scss:1-27` (root variables)
- Modify: `assets/styles/main.scss:865-914` (V2 overrides)

- [ ] **Step 1: Replace `:root` color variables (lines 1-27)**

Replace the first `:root` block with:

```scss
:root {
  --df-bg: #f1f5f9;
  --df-panel: #ffffff;
  --df-text: #1e293b;
  --df-subtext: #64748b;
  --df-primary: #2563eb;
  --df-primary-soft: #eff6ff;
  --df-primary-hover: #1d4ed8;
  --df-border: #e2e8f0;
  --df-surface: #f8fafc;
  --df-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.04);
  --df-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);

  /* Sidebar (permanent dark) */
  --df-sidebar-bg: #1e293b;
  --df-sidebar-text: #94a3b8;
  --df-sidebar-text-active: #ffffff;
  --df-sidebar-active-bg: rgba(37, 99, 235, 0.15);
  --df-sidebar-hover-bg: rgba(255, 255, 255, 0.06);
  --df-sidebar-border: rgba(255, 255, 255, 0.08);

  /* Element Plus overrides */
  --el-color-primary: #2563eb;
  --el-color-primary-light-1: #3b82f6;
  --el-color-primary-light-2: #60a5fa;
  --el-color-primary-light-3: #93bbfd;
  --el-color-primary-light-4: #a5c4fd;
  --el-color-primary-light-5: #b8d4fe;
  --el-color-primary-light-6: #c9dffe;
  --el-color-primary-light-7: #dbeafe;
  --el-color-primary-light-8: #e8f0fe;
  --el-color-primary-light-9: #eff6ff;
  --el-color-primary-dark-2: #1d4ed8;
  --el-border-radius-base: 6px;
  --el-border-radius-small: 4px;
}
```

- [ ] **Step 2: Replace the V2 overrides block (lines 861-914)**

Replace the `/* Design System V2 Overrides */` section with:

```scss
/* =========================
   Design System V3 — Graphite Dual-tone
   ========================= */

:root {
  --df-font-heading: "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
  --df-font-sans: "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  --df-font-mono: "JetBrains Mono", "Cascadia Code", "Fira Code", monospace;

  --df-radius-xs: 4px;
  --df-radius-sm: 6px;
  --df-radius-md: 8px;
  --df-radius-lg: 12px;

  --df-space-1: 4px;
  --df-space-2: 8px;
  --df-space-3: 12px;
  --df-space-4: 16px;
  --df-space-5: 20px;
  --df-space-6: 24px;
  --df-space-7: 32px;

  --df-fs-xs: 12px;
  --df-fs-sm: 13px;
  --df-fs-md: 14px;
  --df-fs-lg: 16px;
  --df-fs-xl: 20px;
}
```

- [ ] **Step 3: Update body font-family (line 75)**

Change:
```scss
font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
```
To:
```scss
font-family: var(--df-font-sans);
```

- [ ] **Step 4: Update body background gradient (line 77)**

Change:
```scss
background: radial-gradient(circle at top right, #eef2ff 0%, #f5f5f5 28%, #f5f5f5 100%);
```
To:
```scss
background: #f1f5f9;
```

- [ ] **Step 5: Verify no duplicate variable definitions remain**

Search `main.scss` for any remaining `--df-bg`, `--df-panel`, `--df-primary` definitions outside the new blocks. Remove the second `:root` block (old V2 overrides at lines 865+) entirely since we replaced it.

---

### Task 2: Update sidebar to dark graphite theme in main.scss

**Files:**
- Modify: `assets/styles/main.scss:109-355` (sidebar styles)

- [ ] **Step 1: Update .pf-sidebar base styles**

Change `.pf-sidebar` (around line 109):
```scss
.pf-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--df-sidebar-bg);
  color: var(--df-sidebar-text);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--df-sidebar-border);
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
```

- [ ] **Step 2: Update .pf-brand styles**

Change `.pf-brand` border color:
```scss
.pf-brand {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-bottom: 1px solid var(--df-sidebar-border);
  overflow: hidden;
}
```

- [ ] **Step 3: Update .pf-brand-logo gradient**

Change (around line 188):
```scss
.pf-brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}
```

- [ ] **Step 4: Update .pf-brand-text for dark sidebar**

```scss
.pf-brand-text {
  color: #ffffff;
  font-family: var(--df-font-heading);
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.2s ease, width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
```

- [ ] **Step 5: Update .pf-sidebar-toggle for dark sidebar**

```scss
.pf-sidebar-toggle {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--df-sidebar-text);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  min-width: 28px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.pf-sidebar-toggle:hover {
  color: #ffffff;
  background: var(--df-sidebar-hover-bg);
}
```

- [ ] **Step 6: Update .pf-nav-title for dark sidebar**

Change (around line 225):
```scss
.pf-nav-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 14px 10px 6px;
  color: rgba(148, 163, 184, 0.6);
}
```

- [ ] **Step 7: Update .pf-nav-item colors for dark sidebar**

```scss
.pf-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--df-sidebar-text);
  padding: 9px 12px;
  border-radius: 6px;
  margin-bottom: 3px;
  transition: background 0.2s ease, color 0.2s ease;
  font-size: 13px;
}

.pf-nav-item:hover {
  background: var(--df-sidebar-hover-bg);
  color: var(--df-sidebar-text-active);
}

.pf-nav-item.active {
  background: var(--df-sidebar-active-bg);
  color: var(--df-sidebar-text-active);
  font-weight: 600;
  box-shadow: none;
}
```

- [ ] **Step 8: Update .pf-user section for dark sidebar**

```scss
.pf-user {
  border-top: 1px solid var(--df-sidebar-border);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 64px;
}

.pf-user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
```

- [ ] **Step 9: Update .pf-header — remove sidebar hover transition**

Change `.pf-header` (around line 403):
```scss
.pf-header {
  height: 60px;
  border-bottom: 1px solid var(--df-border);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 22px;
}
```

- [ ] **Step 10: Update .pf-user-entry-avatar gradient**

Change (around line 463):
```scss
&--text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
}
```

---

### Task 3: Update radius throughout main.scss

**Files:**
- Modify: `assets/styles/main.scss` (multiple locations)

- [ ] **Step 1: Update all hardcoded border-radius values**

Search and replace in main.scss:
- `border-radius: 12px` → `border-radius: var(--df-radius-md)` (for cards: `.pf-card`, `.repo-card`, `.notice-item`, `.login-card`)
- `border-radius: 10px` → `border-radius: var(--df-radius-sm)` (for `.repo-card`)
- `border-radius: 8px` → `border-radius: var(--df-radius-xs)` (for nav items, buttons, inputs)
- Keep `border-radius: 50%` and `border-radius: 999px` unchanged (avatars, pills)

Key replacements:
- `.pf-nav-item` → `border-radius: var(--df-radius-xs);`
- `.pf-card` → `border-radius: var(--df-radius-md);`
- `.pf-btn` → `border-radius: var(--df-radius-xs);`
- `.repo-card` → `border-radius: var(--df-radius-sm);`
- `.login-card` → `border-radius: var(--df-radius-lg);`

- [ ] **Step 2: Remove hover translateY/translateX effects**

Remove these transform rules:
- `.pf-nav-item:hover { transform: translateX(1px); }` — delete the transform line
- Any `.pf-btn:hover { transform: translateY(-1px); }` — delete the transform line

---

### Task 4: Update element-overrides.scss

**Files:**
- Modify: `assets/styles/element-overrides.scss`

- [ ] **Step 1: Update primary color**

```scss
@forward 'element-plus/theme-chalk/src/common/var.scss' with (
  $colors: (
    'primary': (
      'base': #2563eb,
    ),
    'success': (
      'base': #10b981,
    ),
    'warning': (
      'base': #f59e0b,
    ),
    'danger': (
      'base': #ef4444,
    ),
    'info': (
      'base': #64748b,
    ),
  ),
);
```

---

### Task 5: Update dark.scss

**Files:**
- Modify: `assets/styles/dark.scss`

- [ ] **Step 1: Update core dark palette**

Replace lines 6-50 with:
```scss
html.dark {
  color-scheme: dark;

  /* ---- Core palette ---- */
  --df-bg: #0f172a;
  --df-panel: #1e293b;
  --df-surface: #334155;
  --df-text: #e2e8f0;
  --df-subtext: #94a3b8;
  --df-border: #334155;

  --df-primary: #3b82f6;
  --df-primary-soft: rgba(59, 130, 246, 0.12);
  --df-primary-hover: #60a5fa;

  --df-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
  --df-shadow-md: 0 14px 30px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.24);

  /* Sidebar in dark mode — even darker */
  --df-sidebar-bg: #0f172a;
  --df-sidebar-text: #94a3b8;
  --df-sidebar-text-active: #ffffff;
  --df-sidebar-active-bg: rgba(59, 130, 246, 0.15);
  --df-sidebar-hover-bg: rgba(255, 255, 255, 0.06);
  --df-sidebar-border: rgba(255, 255, 255, 0.06);

  /* ---- Element Plus overrides ---- */
  --el-color-primary: #3b82f6;
  --el-color-primary-light-1: #60a5fa;
  --el-color-primary-light-2: #93bbfd;
  --el-color-primary-light-3: #a5c4fd;
  --el-color-primary-light-4: #b8d4fe;
  --el-color-primary-light-5: #c9dffe;
  --el-color-primary-light-6: #dbeafe;
  --el-color-primary-light-7: rgba(59, 130, 246, 0.2);
  --el-color-primary-light-8: rgba(59, 130, 246, 0.15);
  --el-color-primary-light-9: rgba(59, 130, 246, 0.08);
  --el-color-primary-dark-2: #2563eb;
  --el-bg-color: #1e293b;
  --el-bg-color-overlay: #334155;
  --el-bg-color-page: #0f172a;
  --el-text-color-primary: #e2e8f0;
  --el-text-color-regular: #cbd5e1;
  --el-text-color-secondary: #94a3b8;
  --el-text-color-placeholder: #64748b;
  --el-border-color: #334155;
  --el-border-color-light: #475569;
  --el-border-color-lighter: #475569;
  --el-fill-color-blank: #1e293b;
  --el-fill-color: #334155;
  --el-fill-color-light: #475569;
  --el-mask-color: rgba(0, 0, 0, 0.6);
```

- [ ] **Step 2: Update dark sidebar styles**

Replace the dark `.pf-sidebar` section with:
```scss
  /* ---- Sidebar (darker in dark mode) ---- */
  .pf-sidebar {
    background: var(--df-sidebar-bg);
    border-right-color: var(--df-sidebar-border);
  }

  .pf-brand {
    border-bottom-color: var(--df-sidebar-border);
  }

  .pf-brand-logo {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  }
```

- [ ] **Step 3: Update all purple (#a78bfa, #8b5cf6, #7c3aed) references to blue**

Replace throughout dark.scss:
- `#a78bfa` → `#3b82f6`
- `#8b5cf6` → `#2563eb`
- `#7c3aed` → `#1d4ed8`
- `rgba(167, 139, 250, ...)` → `rgba(59, 130, 246, ...)`

- [ ] **Step 4: Update dark mode login styles**

Replace login-related dark styles with:
```scss
  /* ---- Login page ---- */
  .login-page {
    background: #0f172a;
  }

  .login-hero {
    background: #0f172a;
  }

  .login-card {
    background: #1e293b;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.06),
      0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .login-card:hover {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .login-header h2 {
    color: #e2e8f0;
  }

  .login-header p {
    color: #64748b;
  }

  .login-submit {
    background: #2563eb;
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
  }

  .login-submit:hover {
    background: #1d4ed8;
    box-shadow: 0 6px 24px rgba(37, 99, 235, 0.4);
  }

  .login-divider {
    color: #64748b;
  }

  .login-divider::before,
  .login-divider::after {
    background: #334155;
  }

  .feishu-login-btn {
    background: #334155;
    color: #cbd5e1;
    border-color: #475569;
  }

  .feishu-login-btn:hover,
  .feishu-login-btn:focus {
    background: #475569;
    color: #e2e8f0;
    border-color: #64748b;
  }

  .login-tips {
    border-color: #334155;
    background: rgba(51, 65, 85, 0.5);
  }

  .login-tips p {
    color: #64748b;
  }

  .feishu-fullscreen-loading {
    background: #0f172a;
  }

  .feishu-loading-bounce {
    background: #3b82f6;
  }
```

- [ ] **Step 5: Remove all aurora-related dark mode styles**

Delete these dark mode rules (they no longer exist in the login page):
- `.aurora-ribbon--1`, `.aurora-ribbon--2`, `.aurora-ribbon--3`
- `.aurora-glow--tl`, `.aurora-glow--br`
- `.dot-grid`
- `.hero-title-line`, `.hero-title-line--accent`
- `.hero-desc`
- `.brand-placeholder .brand-icon`, `.brand-placeholder .brand-text`

- [ ] **Step 6: Update dark mode input focus color**

Replace:
```scss
  .login-form .el-input__wrapper.is-focus {
    box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.3) inset;
  }
```
With:
```scss
  .login-form .el-input__wrapper.is-focus {
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3) inset;
  }
```

And replace:
```scss
  .el-input__wrapper.is-focus,
  .el-select__wrapper.is-focused,
  .el-textarea__inner:focus {
    box-shadow:
      0 0 0 1px #a78bfa inset,
      0 0 0 4px rgba(167, 139, 250, 0.12);
  }
```
With:
```scss
  .el-input__wrapper.is-focus,
  .el-select__wrapper.is-focused,
  .el-textarea__inner:focus {
    box-shadow:
      0 0 0 1px #3b82f6 inset,
      0 0 0 4px rgba(59, 130, 246, 0.12);
  }
```

- [ ] **Step 7: Update dark mode el-table hover color**

Replace all `rgba(167, 139, 250, ...)` in table styles with `rgba(59, 130, 246, ...)`.

---

### Task 6: Update components.scss

**Files:**
- Modify: `assets/styles/components.scss`

- [ ] **Step 1: Update hardcoded border-radius values**

Replace throughout:
- `border-radius: 12px` → `border-radius: var(--df-radius-md)`
- `border-radius: 16px` → `border-radius: var(--df-radius-lg)`
- `border-radius: 10px` → `border-radius: var(--df-radius-sm)`
- `border-radius: 8px` → `border-radius: var(--df-radius-xs)`

- [ ] **Step 2: Update hardcoded primary color references**

Replace:
- `#4f46e5` → `var(--df-primary-hover)` (in `.df-table-toolbar-right .el-button--primary:hover`)
- `rgba(99, 102, 241, 0.1)` → `rgba(37, 99, 235, 0.1)` (in `.df-table-search` focus)
- `#6366f1` → `var(--df-primary)` (if any remaining)

- [ ] **Step 3: Update file type icon colors (keep as-is)**

The file type icon colors (`.is-pdf` #ef4444, `.is-word` #3b82f6, etc.) are semantic and should stay. But update `.is-md`:
- Change `.is-md { background: #8b5cf6; }` → `.is-md { background: #64748b; }` (use slate instead of purple)

- [ ] **Step 4: Update compare pane hardcoded colors**

These are semantic (red = old, green = new) — keep #fef2f2, #f0fdf4, #bbf7d0, #fecaca, etc. No changes needed for diff colors.

---

### Task 7: Redesign login page (pages/login.vue)

**Files:**
- Modify: `pages/login.vue` (template and style sections)

- [ ] **Step 1: Replace the template section**

Replace the entire `<template>` with a two-panel layout:

```vue
<template>
  <!-- Feishu callback: fullscreen loading -->
  <div v-if="feishuCallbackPending" class="feishu-fullscreen-loading">
    <div class="feishu-loading-card">
      <div class="feishu-loading-spinner">
        <div class="feishu-loading-bounce" />
        <div class="feishu-loading-bounce" />
        <div class="feishu-loading-bounce" />
      </div>
      <p class="feishu-loading-text">飞书登录中，请稍候…</p>
    </div>
  </div>

  <section v-else class="login-page">
    <!-- Left dark hero panel -->
    <div class="login-hero">
      <div class="login-hero-pattern" />
      <div class="login-hero-content">
        <div class="brand-placeholder">
          <div class="brand-icon">DF</div>
          <div class="brand-text">DocFlow</div>
        </div>
        <h1 class="hero-title">
          <span class="hero-title-line">高效协作</span>
          <span class="hero-title-line hero-title-line--accent">从文档开始</span>
        </h1>
        <p class="hero-desc">统一管理 · 版本追溯 · 流程审批 · 安全可控</p>
      </div>
    </div>

    <!-- Right login form -->
    <div class="login-content">
      <article class="login-card">
        <header class="login-header">
          <h2>账号登录</h2>
          <p>支持账号密码与飞书登录</p>
        </header>

        <el-form
          ref="formRef" :model="form" :rules="rules" label-position="top" class="login-form"
          @submit.prevent="handleSubmit">
          <el-form-item label="账号（邮箱或飞书 Open ID）" prop="account">
            <el-input
              v-model="form.account" placeholder="admin@docflow.local" autocomplete="username" clearable
              @keyup.enter="handleSubmit">
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password" type="password" show-password placeholder="请输入密码"
              autocomplete="current-password" @keyup.enter="handleSubmit">
              <template #prefix>
                <el-icon><Lock /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <div class="login-row">
            <el-checkbox v-model="rememberSession" label="保持会话" />
          </div>

          <el-button class="login-submit" type="primary" :loading="submitting" @click="handleSubmit">
            登录
          </el-button>
        </el-form>

        <div class="login-divider"><span>或</span></div>

        <el-button class="feishu-login-btn" :loading="feishuLoading" @click="handleFeishuLogin">
          <img class="feishu-icon" :src="feishuIconSrc" alt="飞书" width="18" height="18">
          飞书登录
        </el-button>

        <section class="login-tips">
          <p>演示账号：admin@docflow.local</p>
          <p>演示密码：Docflow@123（可通过 AUTH_DEMO_PASSWORD 配置）</p>
        </section>
      </article>
    </div>

    <CaptchaDialog v-model:visible="captchaVisible" @confirm="handleCaptchaConfirm" @cancel="handleCaptchaCancel" />
  </section>
</template>
```

- [ ] **Step 2: Replace the entire `<style>` section**

```scss
<style lang="scss" scoped>
/* ============================================
   Login Page — Graphite Dual-tone
   ============================================ */
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  overflow: hidden;
  background: #f1f5f9;
}

/* ============================================
   Left Hero Panel
   ============================================ */
.login-hero {
  position: relative;
  width: 44%;
  min-width: 400px;
  background: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Geometric grid pattern */
.login-hero-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 70%);
}

.login-hero-content {
  position: relative;
  z-index: 1;
  padding: 0 48px;
}

.brand-placeholder {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 48px;
}

.brand-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.brand-text {
  color: #ffffff;
  font-family: var(--df-font-heading);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.hero-title {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-title-line {
  display: block;
  font-family: var(--df-font-heading);
  font-size: clamp(28px, 3vw, 44px);
  font-weight: 800;
  letter-spacing: 1px;
  color: #e2e8f0;
  line-height: 1.3;

  &--accent {
    color: #3b82f6;
  }
}

.hero-desc {
  margin: 18px 0 0;
  font-size: 14px;
  color: #64748b;
  letter-spacing: 2px;
  font-weight: 400;
}

/* ============================================
   Right Login Form
   ============================================ */
.login-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.login-card {
  width: 400px;
  max-width: 100%;
  background: #ffffff;
  border-radius: var(--df-radius-lg, 12px);
  padding: 32px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 4px 24px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s;

  &:hover {
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.04),
      0 8px 32px rgba(0, 0, 0, 0.08);
  }
}

.login-header {
  margin-bottom: 24px;

  h2 {
    margin: 0;
    text-align: center;
    font-family: var(--df-font-heading);
    font-size: 22px;
    font-weight: 700;
    color: #1e293b;
  }

  p {
    margin: 6px 0 0;
    color: #64748b;
    font-size: 13px;
    text-align: center;
  }
}

.login-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    color: #475569;
    font-weight: 500;
  }

  :deep(.el-input__wrapper) {
    min-height: 42px;
    border-radius: var(--df-radius-sm, 6px);
    box-shadow: 0 0 0 1px #e2e8f0 inset;
    background: #ffffff;
    transition: all 0.2s;

    &:hover {
      box-shadow: 0 0 0 1px #cbd5e1 inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #2563eb inset, 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
  }
}

.login-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 0 16px;
}

.login-submit {
  width: 100%;
  height: 42px;
  margin-top: 2px;
  border-radius: var(--df-radius-sm, 6px);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  border: none;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
  transition: all 0.2s;

  &:hover {
    background: #1d4ed8;
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.28);
  }

  &:active {
    background: #1e40af;
  }
}

.login-divider {
  display: flex;
  align-items: center;
  margin: 18px 0 14px;
  color: #94a3b8;
  font-size: 12px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }

  span {
    padding: 0 12px;
  }
}

.feishu-login-btn {
  width: 100%;
  height: 42px;
  border-radius: var(--df-radius-sm, 6px);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;

  &:hover,
  &:focus {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #cbd5e1;
  }

  .feishu-icon {
    margin-right: 6px;
    border-radius: 4px;
  }
}

.login-tips {
  margin-top: 16px;
  padding: 10px 14px;
  border-radius: var(--df-radius-sm, 6px);
  border: 1px dashed #e2e8f0;
  background: #f8fafc;

  p {
    margin: 0;
    font-size: 12px;
    color: #64748b;

    & + p {
      margin-top: 3px;
    }
  }
}

/* ============================================
   Responsive
   ============================================ */
@media (max-width: 1024px) {
  .login-hero {
    display: none;
  }
}

@media (max-width: 900px) {
  .login-content {
    padding: 16px;
  }

  .login-card {
    padding: 24px 20px;
  }
}

/* ---- Feishu fullscreen loading ---- */
.feishu-fullscreen-loading {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
}

.feishu-loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.feishu-loading-spinner {
  display: flex;
  gap: 8px;
}

.feishu-loading-bounce {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #2563eb;
  animation: feishu-bounce 1.4s ease-in-out infinite both;

  &:nth-child(1) {
    animation-delay: -0.32s;
  }

  &:nth-child(2) {
    animation-delay: -0.16s;
  }
}

@keyframes feishu-bounce {
  0%, 80%, 100% {
    transform: scale(0.4);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.feishu-loading-text {
  margin: 0;
  font-size: 16px;
  color: #64748b;
  letter-spacing: 1px;
}
</style>
```

---

### Task 8: Update nuxt.config.ts — add Google Fonts and update CSP

**Files:**
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Add Google Fonts link to head**

Add to `nuxt.config.ts` inside `export default defineNuxtConfig({`:

```ts
app: {
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
```

- [ ] **Step 2: Update CSP font-src to allow Google Fonts**

Change in the `security.headers.contentSecurityPolicy` block:
```ts
'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
```

---

### Task 9: Update hardcoded colors in main.scss V2 overrides section

**Files:**
- Modify: `assets/styles/main.scss:930-1160+` (the section after V2/V3 block)

- [ ] **Step 1: Update .pf-brand-logo in V2 section**

This section duplicates sidebar styles. Replace:
```scss
.pf-brand-logo {
  background: linear-gradient(135deg, #6366f1, #a5b4fc);
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);
}
```
With:
```scss
.pf-brand-logo {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
}
```

- [ ] **Step 2: Update nav active state**

Replace:
```scss
.pf-nav-item.active {
  background: #eef2ff;
  box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.2);
}
```
With:
```scss
.pf-nav-item.active {
  background: var(--df-sidebar-active-bg);
  box-shadow: none;
}
```

- [ ] **Step 3: Update .pf-sidebar background**

```scss
.pf-sidebar {
  width: 252px;
  background: var(--df-sidebar-bg);
  border-right: 1px solid var(--df-sidebar-border);
}
```

- [ ] **Step 4: Update .pf-brand border**

```scss
.pf-brand {
  border-bottom: 1px solid var(--df-sidebar-border);
}
```

- [ ] **Step 5: Update .pf-user-entry-avatar gradient**

```scss
.pf-user-entry-avatar {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
}
```

- [ ] **Step 6: Update input focus box-shadow**

Replace:
```scss
.login-form :deep(.el-input__wrapper.is-focus),
.el-input__wrapper.is-focus,
.el-select__wrapper.is-focused,
.el-textarea__inner:focus {
  box-shadow: 0 0 0 1px #6366f1 inset, 0 0 0 4px rgba(99, 102, 241, 0.12);
}
```
With:
```scss
.login-form :deep(.el-input__wrapper.is-focus),
.el-input__wrapper.is-focus,
.el-select__wrapper.is-focused,
.el-textarea__inner:focus {
  box-shadow: 0 0 0 1px #2563eb inset, 0 0 0 4px rgba(37, 99, 235, 0.12);
}
```

- [ ] **Step 7: Update .pf-btn.primary box-shadow**

Replace:
```scss
.pf-btn.primary {
  box-shadow: 0 10px 16px rgba(99, 102, 241, 0.2);
}
.pf-btn.primary:hover {
  box-shadow: 0 12px 18px rgba(99, 102, 241, 0.24);
}
```
With:
```scss
.pf-btn.primary {
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
}
.pf-btn.primary:hover {
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.24);
}
```

- [ ] **Step 8: Update .pf-table th background**

Replace `background: #fafafa;` with `background: var(--df-surface);` in .pf-table th (around line 669).

- [ ] **Step 9: Update hardcoded text colors**

Replace throughout the V2 section:
- `color: #52525b` → `color: var(--df-sidebar-text)` (in .pf-nav-item)
- `color: #a1a1aa` → `color: rgba(148, 163, 184, 0.6)` (in .pf-nav-title)
- `color: #374151` → `color: var(--df-text)` (in .pf-btn, .preview-doc p)
- `color: #4b5563` → `color: var(--df-subtext)` (in .notice-item p)
- `color: #9ca3af` → `color: var(--df-subtext)` (in .pf-user-entry-caret)

---

### Task 10: Update CaptchaDialog.vue colors

**Files:**
- Modify: `components/CaptchaDialog.vue`

- [ ] **Step 1: Update click dot gradient**

Replace:
```scss
background: linear-gradient(135deg, #3b82f6, #6366f1);
```
With:
```scss
background: linear-gradient(135deg, #2563eb, #3b82f6);
```

- [ ] **Step 2: Update active progress dot color**

Replace `#3b82f6` with `#2563eb` for the active progress dot.

---

### Task 11: Update remaining hardcoded colors in pages

**Files:**
- Modify: `pages/docs/file/[id].vue`
- Modify: `pages/index.vue`

- [ ] **Step 1: Update file/[id].vue badge colors**

These are semantic (red/green for diff) — keep as-is. No changes needed.

- [ ] **Step 2: Verify pages/index.vue uses CSS variables**

Read and confirm no hardcoded indigo/purple colors remain. Fix any found.

---

### Task 12: Update login-page global fallback in main.scss

**Files:**
- Modify: `assets/styles/main.scss:86-101` (login-page fallback)

- [ ] **Step 1: Update global .login-page fallback**

Replace:
```scss
.login-page {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 100vh;
  padding-right: clamp(42px, 7vw, 128px);
  background-position: center center;
  background-size: cover;
  background-repeat: no-repeat;

  @media (max-width: 900px) {
    justify-content: center;
    padding: 16px;
  }
}
```
With:
```scss
.login-page {
  display: flex;
  min-height: 100vh;
  background: #f1f5f9;
}
```

- [ ] **Step 2: Also update the second .login-page block (around line 776)**

Replace the `.login-page` block at line 776 with:
```scss
.login-page {
  min-height: 100vh;
  display: flex;
}
```

---

### Task 13: Smoke test and visual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (or `pnpm dev`)
Expected: Server starts without SCSS compilation errors.

- [ ] **Step 2: Check login page**

Navigate to `/login`. Verify:
- Left panel: dark graphite with grid pattern, blue brand icon, white text
- Right panel: clean white card, blue submit button, no gradients
- No aurora, no dots, no frosted glass

- [ ] **Step 3: Check main app (prototype layout)**

Navigate to `/docs`. Verify:
- Sidebar: dark graphite background, light text, blue active highlight
- Header: white/light with blur
- Content: light slate background
- Cards: small border-radius (6-8px)

- [ ] **Step 4: Check dark mode**

Toggle dark mode. Verify:
- Sidebar becomes even darker (#0f172a)
- Content area dark slate
- Blue accent preserved
- No purple remnants

- [ ] **Step 5: Check all pages load without errors**

Visit each page: `/docs`, `/approvals`, `/logs`, `/notifications`, `/recycle-bin`, `/profile`, `/admin`
Expected: No broken styles, consistent look.

---

### Task 14: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add assets/styles/ pages/login.vue nuxt.config.ts components/CaptchaDialog.vue
git commit -m "feat: redesign to Graphite Dual-tone theme — dark sidebar, blue accent, reduced radius, Plus Jakarta Sans"
```
