# CORTEX development

## Prerequisites

Use the Bun version pinned in the root `package.json` and Node.js version declared there. Install
dependencies from the repository root with `bun install`.

## Local surfaces

- `bun run dev:marketing` starts the public Next.js site.
- `bun run dev:web` starts the Vite Web application.
- `bun run --cwd apps/cloud-control dev` starts Cloud Control after its required environment
  variables are present.

Do not use the default local server or its state directory for browser/cloud experiments when a
separate instance might already be running. Follow the isolated-home and port guidance in the root
`AGENTS.md`.

## Cloud Control

Copy the non-secret shape from `.env.example` into your untracked environment. Cloud Control
requires a PostgreSQL application-role URL, Supabase URL, and Supabase publishable key at start.
Apply migrations `apps/cloud-control/migrations/0001_initial.sql` through the latest migration
with the migration owner before running the application role.

## Verification

The root validation commands are `bun run fmt:check`, `bun run lint`, `bun run typecheck`,
`bun run test`, and `bun run build`. Run focused workspace tests with
`bun run --cwd apps/cloud-control test` and `bun run --cwd apps/web test` when the Bun environment
is available. Do not use `bun test`; it bypasses the repository's test script.
