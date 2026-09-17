# CORTEX security boundaries

## Browser and session security

Cloud sessions are opaque, server-verified values in Secure/HttpOnly cookies. The browser does
not receive or store a Supabase access token as its CORTEX session. Cloud Control only grants CORS
credentials to exact configured origins; wildcard origins are not allowed.

## Tenant isolation

Every Cloud Control request resolves an authenticated identity and organization before queries.
Database transactions receive scoped user/organization settings, and relevant tables use forced
PostgreSQL RLS. Application queries also filter by organization as defense in depth. Never accept
an organization or workspace ID as authorization on its own.

## Cloud file safety

Cloud file paths are canonical absolute paths. The server decodes browser URL path encoding once,
normalizes the result, rejects control characters, backslashes, traversal, and paths beyond the
database limit, and scopes lookup/write/delete by both workspace and organization. File saves use
a version to reject stale writers instead of silently overwriting content.

## Runtime and secret policy

No hosted runtime is currently available. Do not add a command-execution endpoint to Cloud Control
or a Vercel route. A future runner must be isolated, lease-fenced, resource-limited, and must
redact credentials from process arguments, logs, errors, events, and browser responses. Database
URLs, OAuth secrets, GitHub tokens, model keys, and private keys remain server-side only.
