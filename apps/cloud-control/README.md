# CORTEX Cloud Control Plane

This is a new, independently deployable Cloud boundary. It is **not** imported by or a
replacement for the local-first `apps/server` runtime.

## Current capability

- `GET /healthz` returns process liveness.
- `GET /readyz` verifies PostgreSQL connectivity.
- `POST /api/cloud/auth/signup` and `POST /api/cloud/auth/login` use Supabase Auth,
  then idempotently provision the CORTEX user, personal organization, and owner membership.
- `GET /api/cloud/auth/session` verifies the HttpOnly Supabase access-token cookie with
  Supabase's `/auth/v1/user` endpoint.
- `POST /api/cloud/auth/logout` clears the application cookie.
- `/v1/organizations` and `/v1/projects` require a verified identity and execute inside a
  transaction-scoped `synara.user_id` / `synara.organization_id` context.
- The canonical Supabase project is `ownnbyhsflmdjytwaeqv`; its URL and publishable key are
  supplied through deployment environment variables and are never committed.
- `migrations/0004_api_tokens.sql` adds storage for hashed CORTEX API-token metadata;
  token-management endpoints remain a separate authenticated capability.

## Local startup

```console
CORTEX_DATABASE_URL=postgresql://app:password@127.0.0.1:5432/cortex \
  bun run --cwd apps/cloud-control dev
```

Configuration is fail-fast:

| Variable              | Required | Meaning                                                                          |
| --------------------- | -------- | -------------------------------------------------------------------------------- |
| `CORTEX_DATABASE_URL` | yes      | PostgreSQL application-role URL. Never use the migration owner for HTTP traffic. |
| `SUPABASE_URL` | yes | Canonical Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable key; never use a secret/service-role key here. |
| `PORT`                 | no       | Listener port; defaults to `8787`.                                               |
| `HOST`                 | no       | Listener host; defaults to `0.0.0.0`.                                            |
| `CORTEX_ENVIRONMENT`  | no       | `development`, `staging`, or `production`; defaults to `development`.            |
| `CORTEX_SESSION_COOKIE` | no | HttpOnly cookie name; defaults to `cortex_cloud_session`. |
| `CORTEX_SESSION_TTL_SECONDS` | no | Cookie lifetime; defaults to seven days. |
| `CORTEX_COOKIE_SECURE` | no | Defaults to secure cookies unless explicitly `false`. |

## Token-security contract

The control plane will generate `ctx_live_…` tokens with a cryptographic RNG, display
the raw secret once in the create response, store only a domain-separated SHA-256 digest
and prefix, compare candidate digests in constant time, and enforce expiry, revocation,
organization context, and scopes server-side. Raw tokens must never appear in logs,
telemetry, audit metadata, browser storage, token lists, or token-detail responses.

Do not add a `/v1/ai/*` handler until the identity, tenant transaction, API-token
authentication, quota, audit, and execution-plane boundaries described in
[`../../audit/PLATFORM_READINESS_AUDIT.md`](../../audit/PLATFORM_READINESS_AUDIT.md) are
implemented and tested.
