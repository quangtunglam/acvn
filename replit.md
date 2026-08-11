# VietPress EU

VietPress EU is a Vietnamese-language news portal for the Vietnamese community in the Czech Republic and across Europe.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/tin-tuc-portal/src/` — responsive editorial homepage and visual theme.
- `artifacts/api-server/src/routes/` — Express API routes.
- `lib/api-spec/openapi.yaml` — source of truth for public API contracts.
- `lib/db/src/schema/content.ts` — Drizzle schema for editorial content and supporting records.
- `scripts/src/seed-news.ts` — migration seed for the reference homepage content.

## Architecture decisions

- The existing VietPress EU homepage is the visual source of truth; application work adds data and workflows without replacing its editorial character.
- PostgreSQL is the source of truth for articles, people, taxonomy, events, newsletter subscribers, and future advertising records.
- The public API is contract-first through OpenAPI and generated Zod/React Query helpers.
- Content is seeded from the supplied reference HTML so the first dynamic homepage can preserve the current sample experience.

## Product

- Responsive Vietnamese news homepage with breaking-news ticker, featured stories, EU country coverage, business and community sections, events, newsletter capture, and search.
- Backend foundation for article pages, taxonomy pages, search, view counting, newsletter subscriptions, and future CMS workflows.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.
- After changing `lib/db/src/schema`, run `pnpm --filter @workspace/db run push`.
- Run `pnpm --filter @workspace/scripts run seed-news` after schema changes when refreshing local reference content.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
