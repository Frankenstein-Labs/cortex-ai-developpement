# CORTEX Cloud deployment handoff

## Current architecture

The repository contains **three** independently deployable surfaces. `apps/marketing` is the public Next.js marketing site; `apps/web` is the authenticated Vite single-page application; `apps/cloud-control` is a standalone Bun HTTP API using `Bun.SQL` against PostgreSQL and Supabase Auth. Cloud Control is not a Next.js API route and must not be mounted into marketing as a fake backend.

The public navigation deliberately crosses from marketing to the Web deployment: marketing sends **Sign in** to `${NEXT_PUBLIC_CORTEX_APP_URL}/login` and **Get started** to `${NEXT_PUBLIC_CORTEX_APP_URL}/signup`. The Web application calls Cloud Control using `VITE_CLOUD_CONTROL_URL` with credentialed fetches. Do not point either variable at a preview URL in production.

## Cloud Control deployment

Deploy `apps/cloud-control/Dockerfile` from the repository root. The container listens on `HOST:PORT`, defaults to `0.0.0.0:8787` locally, and exposes `/healthz` and `/readyz`. The deployment must use a public HTTPS hostname so secure credentialed cookies work from the web application.

Required runtime variables are:

| Variable                     | Required | Value                                                                                |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `CORTEX_DATABASE_URL`        | yes      | PostgreSQL application-role URL for the canonical Supabase project; never commit it. |
| `SUPABASE_URL`               | yes      | `https://ownnbyhsflmdjytwaeqv.supabase.co`                                           |
| `SUPABASE_PUBLISHABLE_KEY`   | yes      | The canonical project's publishable key; never use a service-role key.               |
| `CORTEX_ENVIRONMENT`         | yes      | `production`                                                                         |
| `CORTEX_COOKIE_SECURE`       | yes      | `true`                                                                               |
| `CORTEX_ALLOWED_ORIGINS`     | yes      | Exact HTTPS origin of the deployed CORTEX Web frontend, without a trailing slash.    |
| `CORTEX_SESSION_COOKIE`      | no       | Defaults to `cortex_cloud_session`.                                                  |
| `CORTEX_SESSION_TTL_SECONDS` | no       | Defaults to `604800`.                                                                |

After deployment, verify both endpoints. A successful `/healthz` proves process liveness; `/readyz` must also succeed because it verifies PostgreSQL connectivity.

## Web deployment

Create a **second Vercel project** with Root Directory `apps/web`. The checked-in `apps/web/vercel.json` builds `dist` and rewrites all SPA deep links (including `/login`, `/signup`, `/cloud/projects/:id`, and `/cloud/workspaces/:id`) to `index.html`. Configure the Vercel project as follows:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Install Command | `bun install --frozen-lockfile` |
| Build Command | `bun run build` |
| Output Directory | `dist` |
| Public variable | `VITE_CLOUD_CONTROL_URL=https://api.<your-domain>` |

Set `NEXT_PUBLIC_CORTEX_APP_URL=https://app.<your-domain>` in the existing Vercel marketing project (Root Directory `apps/marketing`). `NEXT_PUBLIC_CORTEX_APP_URL` and `VITE_CLOUD_CONTROL_URL` are public browser configuration only. `CORTEX_DATABASE_URL` is server-only and must only be set on Cloud Control.

The web application must set:

```text
VITE_CLOUD_CONTROL_URL=https://<public-cloud-control-host>
```

The browser calls the control plane with `credentials: "include"`. The control plane must return an exact `Access-Control-Allow-Origin` matching the web origin and `Access-Control-Allow-Credentials: true`. Do not use `*` and do not replace the cookie with local storage. Prefer `app.<domain>` and `api.<domain>` under the same registrable domain with `CORTEX_COOKIE_SAMESITE=lax`; if they are cross-site, use `CORTEX_COOKIE_SAMESITE=none` and secure cookies. Set `CORTEX_ALLOWED_ORIGINS` to the exact Web origin, not the marketing URL.

## Supabase Auth

The canonical project is `cortex-ai-developpement` (`ownnbyhsflmdjytwaeqv`). Migrations `0001` through `0007` must be applied. Password login/signup uses Supabase Auth and then provisions the CORTEX user, personal organization, owner membership, and opaque `web_sessions` row.

For GitHub and Google, enable each provider in Supabase Auth and configure the provider callback URLs shown by the Supabase dashboard. The current repository deliberately does not invent provider credentials or claim a live OAuth test. Once provider credentials exist, the control plane OAuth callback must create the same opaque CORTEX session used by password login.

## Live validation checklist

Run the following against the deployed services, not against mocks:

1. `GET /healthz` and `GET /readyz`.
2. Signup a disposable test user.
3. Verify the opaque `cortex_cloud_session` cookie does not contain a Supabase JWT.
4. Call session, organizations, and projects endpoints.
5. Create a project and verify tenant ownership.
6. Open `/cloud/projects/<project-id>` and verify its workspace list. Workspace creation requires a connected-repository integration; this UI does not pretend that a workspace or AI runtime exists before that integration has been deployed.
7. Create, read, update, conflict-check, and soft-delete a cloud file.
8. Verify traversal paths are rejected.
9. Logout and verify session returns `401` and the `web_sessions` row is revoked.
10. Login again and verify the organization, project, workspace, and file remain available.
11. Repeat with a second user and verify cross-tenant access is denied at the API and PostgreSQL RLS layers.
