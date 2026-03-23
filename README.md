# DocFlow Starter

A fullstack starter for solo delivery based on:

- Nuxt3 (frontend)
- Nitro (backend runtime in Nuxt server routes)
- Prisma + MySQL
- Pinia
- Element Plus

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
```

## API Placeholders

- `GET /api/health`
- `POST /api/version/compare`
- `POST /api/integrations/feishu/notify`

## Suggested Next Steps

1. Add auth and role model in `prisma/schema.prisma`
2. Implement file upload and preview pipeline
3. Implement version snapshot and diff strategy
4. Connect Feishu webhook for notifications
