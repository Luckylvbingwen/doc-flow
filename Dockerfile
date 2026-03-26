# ── Build stage ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production stage ──
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 仅复制构建产物
COPY --from=builder /app/.output .output
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/prisma prisma

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
