# CORTEX architecture

## Deployable boundaries

CORTEX is deliberately split by trust and workload rather than by arbitrary microservices:

1. **Marketing (`apps/marketing`)** is a Next.js public site. It can run on a web platform such
   as Vercel or Cloudflare through OpenNext. Its `/login`, `/signup`, and `/cloud/*` rewrites keep
   product navigation on one public origin while routing to the Web application.
2. **Web (`apps/web`)** is the authenticated React/Vite SPA. It renders projects and workspaces,
   and talks to Cloud Control with credentialed browser requests. It contains no database,
   provider, or runtime secret.
3. **Cloud Control (`apps/cloud-control`)** is a Bun HTTP service with PostgreSQL and Supabase
   Auth integration. It is the browser identity and tenant authorization boundary.
4. **Local runtime (`apps/server`)** is the existing local-first WebSocket/Codex app-server
   orchestration service. It is not a hosted runner and must not be exposed as one.

## Data and authorization

Cloud Control resolves an opaque HttpOnly CORTEX session, resolves the active organization, then
opens a transaction with `synara.user_id` and `synara.organization_id`. PostgreSQL RLS and
organization-scoped SQL are both required safeguards. `projects`, `workspaces`, and `cloud_files`
use organization ownership; cloud-file writes are role-gated and versioned.

## Execution boundary

There is currently no CORTEX Engine or hosted workspace runner. A future Engine must accept only
lease-fenced, authenticated commands from Cloud Control and provide a container/VM sandbox for
shell, Git, and agent tools. Persistent shell processes, Docker, VM management, and untrusted
commands do not belong in Vercel functions or the Web frontend.

## Current capability status

| Capability | Status | Authority |
| --- | --- | --- |
| Browser signup/login/session | PARTIAL | Cloud Control + Supabase Auth |
| Organization/project metadata | DONE | Cloud Control + PostgreSQL RLS |
| Cloud file list/read/write | DONE | Cloud Control + PostgreSQL RLS |
| Hosted workspace lifecycle | BLOCKED | Requires Engine/runner |
| Hosted terminal, Git, AI agents | BLOCKED | Requires Engine/runner |
| Local agent workspace tools | DONE | `apps/server` local runtime |
