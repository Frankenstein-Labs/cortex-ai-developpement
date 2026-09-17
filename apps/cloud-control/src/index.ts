// FILE: index.ts
// Purpose: CORTEX Cloud control-plane HTTP boundary.
import { SQL } from "bun";
import { loadCloudControlConfig } from "./config";
import { hashCloudFileContent, normalizeCloudFilePath } from "./cloudFiles";
import {
  CloudAuthError,
  createCortexSession,
  ensureCortexUser,
  readSessionToken,
  resolveTenantContext,
  requireRole,
  revokeCortexSession,
  sessionCookie,
  expiredSessionCookie,
  supabasePasswordAuth,
  supabaseSignup,
  supabaseOAuthExchange,
  createOAuthVerifier,
  verifyCortexSession,
  withTenantTransaction,
  type AuthenticatedIdentity,
} from "./auth";

const config = loadCloudControlConfig(process.env);
const sql = new SQL({ url: config.databaseUrl });

function requestId(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && /^[A-Za-z0-9._-]{8,128}$/u.test(incoming) ? incoming : crypto.randomUUID();
}

function response(
  request: Request,
  body: unknown,
  status: number,
  id: string,
  extraHeaders: HeadersInit = {},
): Response {
  const origin = request.headers.get("origin");
  const allowed = origin && config.allowedOrigins.includes(origin) ? origin : undefined;
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-request-id": id,
      ...(allowed
        ? {
            "access-control-allow-origin": allowed,
            "access-control-allow-credentials": "true",
            vary: "Origin",
          }
        : {}),
      ...extraHeaders,
    },
  });
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CloudAuthError(400, "invalid_request", "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function textField(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new CloudAuthError(400, "invalid_request", `${name} is required.`);
  }
  return value.trim();
}

function authSession(
  identity: AuthenticatedIdentity,
  organizationId: string,
  sessionCreated: boolean,
) {
  return {
    user: { id: identity.userId, email: identity.email, emailVerified: identity.emailVerified },
    organizationId,
    sessionCreated,
  };
}

async function routeAuth(request: Request, pathname: string, id: string): Promise<Response> {
  if (request.method === "POST" && pathname === "/api/cloud/auth/signup") {
    const input = await body(request);
    const email = textField(input.email, "email").toLowerCase();
    const password = textField(input.password, "password");
    const result = await supabaseSignup(
      config.supabaseUrl,
      config.supabasePublishableKey,
      email,
      password,
    );
    const identity: AuthenticatedIdentity = {
      userId: result.userId,
      email: result.email,
      emailVerified: result.emailVerified,
      sessionId: crypto.randomUUID(),
    };
    const { organizationId } = await ensureCortexUser(sql, identity);
    if (!result.accessToken) {
      return response(
        request,
        { status: "email_verification_required", ...authSession(identity, organizationId, false) },
        202,
        id,
      );
    }
    const session = await createCortexSession(sql, identity, config.sessionTtlSeconds);
    return response(request, authSession(identity, organizationId, true), 201, id, {
      "set-cookie": sessionCookie(
        config.sessionCookieName,
        session.token,
        config.sessionTtlSeconds,
        config.cookieSecure,
        config.cookieSameSite,
      ),
    });
  }

  if (request.method === "POST" && pathname === "/api/cloud/auth/login") {
    const input = await body(request);
    const email = textField(input.email, "email").toLowerCase();
    const password = textField(input.password, "password");
    const result = await supabasePasswordAuth(
      config.supabaseUrl,
      config.supabasePublishableKey,
      email,
      password,
    );
    const identity: AuthenticatedIdentity = {
      userId: result.user.id,
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      sessionId: crypto.randomUUID(),
    };
    const { organizationId } = await ensureCortexUser(sql, identity);
    const session = await createCortexSession(sql, identity, config.sessionTtlSeconds);
    return response(request, authSession(identity, organizationId, true), 200, id, {
      "set-cookie": sessionCookie(
        config.sessionCookieName,
        session.token,
        config.sessionTtlSeconds,
        config.cookieSecure,
        config.cookieSameSite,
      ),
    });
  }

  if (request.method === "GET" && pathname === "/api/cloud/auth/session") {
    const identity = await verifyCortexSession(request, sql, config.sessionCookieName);
    const { organizationId } = await ensureCortexUser(sql, identity);
    return response(request, authSession(identity, organizationId, true), 200, id);
  }

  if (request.method === "POST" && pathname === "/api/cloud/auth/logout") {
    const token = readSessionToken(request, config.sessionCookieName);
    if (token) await revokeCortexSession(sql, token);
    return response(request, { revoked: true }, 200, id, {
      "set-cookie": expiredSessionCookie(
        config.sessionCookieName,
        config.cookieSecure,
        config.cookieSameSite,
      ),
    });
  }

  const oauthStart = pathname.match(/^\/api\/cloud\/auth\/oauth\/(google|github)\/start$/u);
  if (request.method === "GET" && oauthStart) {
    const provider = oauthStart[1] ?? "google";
    const url = new URL(request.url);
    const requestedRedirect = url.searchParams.get("redirect");
    const redirectOrigin =
      requestedRedirect && config.allowedOrigins.includes(requestedRedirect)
        ? requestedRedirect
        : config.allowedOrigins[0];
    if (!redirectOrigin) {
      throw new CloudAuthError(
        503,
        "oauth_not_configured",
        "OAuth redirect origin is not configured.",
      );
    }
    const { verifier, challenge } = createOAuthVerifier();
    const state = crypto.randomUUID();
    const callback = new URL(`/api/cloud/auth/oauth/${provider}/callback`, url.origin);
    callback.searchParams.set("redirect", redirectOrigin);
    const authorize = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
    authorize.searchParams.set("provider", provider);
    authorize.searchParams.set("redirect_to", callback.toString());
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "s256");
    authorize.searchParams.set("state", state);
    const headers = new Headers({ location: authorize.toString() });
    headers.append(
      "set-cookie",
      sessionCookie("cortex_oauth_state", state, 600, config.cookieSecure),
    );
    headers.append(
      "set-cookie",
      sessionCookie("cortex_oauth_verifier", verifier, 600, config.cookieSecure),
    );
    return new Response(null, { status: 302, headers });
  }

  const oauthCallback = pathname.match(/^\/api\/cloud\/auth\/oauth\/(google|github)\/callback$/u);
  if (request.method === "GET" && oauthCallback) {
    const provider = oauthCallback[1] ?? "google";
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const expectedState = readSessionToken(request, "cortex_oauth_state");
    const verifier = readSessionToken(request, "cortex_oauth_verifier");
    const redirectOrigin = url.searchParams.get("redirect");
    if (!redirectOrigin || !config.allowedOrigins.includes(redirectOrigin)) {
      throw new CloudAuthError(
        400,
        "invalid_oauth_redirect",
        "OAuth redirect origin is not allowed.",
      );
    }
    if (!state || !expectedState || state !== expectedState || !code || !verifier) {
      throw new CloudAuthError(
        400,
        "invalid_oauth_state",
        "OAuth sign-in state is invalid or expired.",
      );
    }
    const result = await supabaseOAuthExchange(
      config.supabaseUrl,
      config.supabasePublishableKey,
      code,
      verifier,
    );
    const identity: AuthenticatedIdentity = {
      userId: result.user.id,
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      sessionId: crypto.randomUUID(),
    };
    const { organizationId } = await ensureCortexUser(sql, identity);
    const session = await createCortexSession(sql, identity, config.sessionTtlSeconds);
    const destination = new URL("/cloud", redirectOrigin);
    destination.searchParams.set("oauth", provider);
    const headers = new Headers({ location: destination.toString() });
    headers.append(
      "set-cookie",
      sessionCookie(
        config.sessionCookieName,
        session.token,
        config.sessionTtlSeconds,
        config.cookieSecure,
        config.cookieSameSite,
      ),
    );
    headers.append("set-cookie", expiredSessionCookie("cortex_oauth_state", config.cookieSecure));
    headers.append(
      "set-cookie",
      expiredSessionCookie("cortex_oauth_verifier", config.cookieSecure),
    );
    return new Response(null, { status: 302, headers });
  }
  return response(request, { error: { code: "not_found", message: "Not found." } }, 404, id);
}

async function routeCloudApi(
  request: Request,
  pathname: string,
  identity: AuthenticatedIdentity,
  id: string,
): Promise<Response> {
  const url = new URL(request.url);
  const requestedOrganizationId = url.searchParams.get("organizationId") ?? undefined;
  const tenant = await resolveTenantContext(sql, identity, requestedOrganizationId);

  return withTenantTransaction(sql, tenant, async (tx) => {
    if (request.method === "GET" && pathname === "/v1/organizations") {
      const organizations = await tx`
        SELECT o.id, o.slug, o.name, (o.personal_owner_user_id = ${identity.userId}::uuid) AS personal, o.created_at
        FROM organizations o JOIN memberships m ON m.organization_id = o.id
        WHERE m.user_id = ${identity.userId}::uuid AND m.revoked_at IS NULL AND o.deleted_at IS NULL
        ORDER BY o.created_at ASC
      `;
      return response(request, { organizations }, 200, id);
    }
    if (request.method === "GET" && pathname === "/v1/projects") {
      const projects = await tx`
        SELECT id, organization_id, name, slug, description, created_by_user_id, created_at, updated_at
        FROM projects WHERE organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL
        ORDER BY updated_at DESC
      `;
      return response(request, { projects }, 200, id);
    }
    if (request.method === "POST" && pathname === "/v1/projects") {
      const input = await body(request);
      const name = textField(input.name, "name");
      const slug = textField(input.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/gu, "-"), "slug");
      const description =
        typeof input.description === "string" ? input.description.trim() || null : null;
      const projectId = crypto.randomUUID();
      let rows;
      try {
        rows = await tx`
          INSERT INTO projects (id, organization_id, name, slug, description, created_by_user_id)
          VALUES (${projectId}::uuid, ${tenant.organizationId}::uuid, ${name}, ${slug}, ${description}, ${tenant.userId}::uuid)
          RETURNING id, organization_id, name, slug, description, created_by_user_id, created_at, updated_at
        `;
      } catch (cause) {
        const error = cause as { code?: string; constraint?: string; detail?: string };
        if (
          error.code === "23505" &&
          (error.constraint === "projects_active_organization_slug_key" ||
            error.constraint === "projects_active_org_slug_idx" ||
            error.detail?.includes("(organization_id, slug)"))
        ) {
          throw new CloudAuthError(
            409,
            "slug_conflict",
            "A project with this slug already exists in the organization.",
          );
        }
        throw cause;
      }
      return response(request, { project: rows[0] }, 201, id);
    }
    const projectMatch = pathname.match(/^\/v1\/projects\/([0-9a-f-]{36})$/u);
    if (request.method === "GET" && projectMatch) {
      const rows = await tx`
        SELECT id, organization_id, name, slug, description, created_by_user_id, created_at, updated_at
        FROM projects WHERE id = ${projectMatch[1]}::uuid AND organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!rows[0])
        return response(
          request,
          { error: { code: "not_found", message: "Project not found." } },
          404,
          id,
        );
      return response(request, { project: rows[0] }, 200, id);
    }

    const projectWorkspacesMatch = pathname.match(/^\/v1\/projects\/([0-9a-f-]{36})\/workspaces$/u);
    if (projectWorkspacesMatch) {
      const projectRows = await tx`
        SELECT id FROM projects
        WHERE id = ${projectWorkspacesMatch[1]}::uuid AND organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!projectRows[0])
        return response(
          request,
          { error: { code: "not_found", message: "Project not found." } },
          404,
          id,
        );
      if (request.method === "GET") {
        const workspaces = await tx`
          SELECT id, project_id, organization_id, name, status, region, base_branch, work_branch, created_at, last_active_at, expires_at
          FROM workspaces WHERE project_id = ${projectWorkspacesMatch[1]}::uuid AND organization_id = ${tenant.organizationId}::uuid AND status <> 'destroyed'
          ORDER BY last_active_at DESC
        `;
        return response(request, { workspaces }, 200, id);
      }
      if (request.method === "POST") {
        requireRole(tenant, "owner", "admin", "member");
        const input = await body(request);
        const name = textField(input.name, "name");
        const connectedRepositoryId = textField(
          input.connectedRepositoryId,
          "connectedRepositoryId",
        );
        const baseBranch = textField(input.baseBranch ?? "main", "baseBranch");
        const region = textField(input.region ?? "eu-central-1", "region");
        const repositoryRows = await tx`
          SELECT id, default_branch FROM connected_repositories
          WHERE id = ${connectedRepositoryId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND revoked_at IS NULL
          LIMIT 1
        `;
        if (!repositoryRows[0])
          return response(
            request,
            { error: { code: "not_found", message: "Connected repository not found." } },
            404,
            id,
          );
        const workspaceId = crypto.randomUUID();
        const workBranch = `cortex/${workspaceId.slice(0, 8)}`;
        const rows = await tx`
          INSERT INTO workspaces (id, organization_id, connected_repository_id, project_id, name, base_branch, base_sha, work_branch, region, quota_policy_id, created_by_user_id, expires_at)
          VALUES (${workspaceId}::uuid, ${tenant.organizationId}::uuid, ${connectedRepositoryId}::uuid, ${projectWorkspacesMatch[1]}::uuid, ${name}, ${baseBranch}, 'unknown', ${workBranch}, ${region}, 'default', ${tenant.userId}::uuid, now() + interval '7 days')
          RETURNING id, project_id, organization_id, name, status, region, base_branch, work_branch, created_at, last_active_at, expires_at
        `;
        return response(request, { workspace: rows[0] }, 201, id);
      }
    }

    const workspaceMatch = pathname.match(/^\/v1\/workspaces\/([0-9a-f-]{36})$/u);
    if (workspaceMatch) {
      const workspaceId = workspaceMatch[1];
      if (request.method === "GET") {
        const rows = await tx`
          SELECT id, project_id, organization_id, name, status, region, base_branch, work_branch, created_at, last_active_at, expires_at
          FROM workspaces WHERE id = ${workspaceId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND status <> 'destroyed'
          LIMIT 1
        `;
        if (!rows[0])
          return response(
            request,
            { error: { code: "not_found", message: "Workspace not found." } },
            404,
            id,
          );
        return response(request, { workspace: rows[0] }, 200, id);
      }
      requireRole(tenant, "owner", "admin", "member");
      if (request.method === "PATCH") {
        const input = await body(request);
        const name = textField(input.name, "name");
        const rows = await tx`
          UPDATE workspaces SET name = ${name}, last_active_at = now()
          WHERE id = ${workspaceId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND status <> 'destroyed'
          RETURNING id, project_id, organization_id, name, status, region, base_branch, work_branch, created_at, last_active_at, expires_at
        `;
        if (!rows[0])
          return response(
            request,
            { error: { code: "not_found", message: "Workspace not found." } },
            404,
            id,
          );
        return response(request, { workspace: rows[0] }, 200, id);
      }
      if (request.method === "DELETE") {
        const rows = await tx`
          UPDATE workspaces SET status = 'destroyed', destroyed_at = now(), termination_reason = 'user-request'
          WHERE id = ${workspaceId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND status <> 'destroyed'
          RETURNING id, status, destroyed_at
        `;
        if (!rows[0])
          return response(
            request,
            { error: { code: "not_found", message: "Workspace not found." } },
            404,
            id,
          );
        return response(request, { workspace: rows[0] }, 200, id);
      }
    }

    const filesMatch = pathname.match(/^\/v1\/workspaces\/([0-9a-f-]{36})\/files(?:\/(.*))?$/u);
    if (filesMatch) {
      const workspaceId = filesMatch[1];
      const workspaceRows = await tx`
        SELECT id FROM workspaces WHERE id = ${workspaceId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND status <> 'destroyed' LIMIT 1
      `;
      if (!workspaceRows[0])
        return response(
          request,
          { error: { code: "not_found", message: "Workspace not found." } },
          404,
          id,
        );
      if (request.method === "GET" && !filesMatch[2]) {
        const files = await tx`
          SELECT id, workspace_id, path, content_hash, version, created_at, updated_at
          FROM cloud_files WHERE workspace_id = ${workspaceId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL ORDER BY path
        `;
        return response(request, { files }, 200, id);
      }
      if (!filesMatch[2])
        return response(
          request,
          { error: { code: "invalid_request", message: "A file path is required." } },
          400,
          id,
        );
      let filePath: string;
      try {
        filePath = normalizeCloudFilePath(`/${filesMatch[2]}`);
      } catch (error) {
        throw new CloudAuthError(
          400,
          "invalid_path",
          error instanceof Error ? error.message : "Invalid file path.",
        );
      }
      if (request.method === "GET") {
        const rows =
          await tx`SELECT id, workspace_id, path, content, content_hash, version, created_at, updated_at FROM cloud_files WHERE workspace_id = ${workspaceId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND path = ${filePath} AND deleted_at IS NULL LIMIT 1`;
        if (!rows[0])
          return response(
            request,
            { error: { code: "not_found", message: "File not found." } },
            404,
            id,
          );
        return response(request, { file: rows[0] }, 200, id);
      }
      if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
        requireRole(tenant, "owner", "admin", "member");
        const input = await body(request);
        const content =
          typeof input.content === "string" ? input.content : textField(input.content, "content");
        const expectedVersion =
          typeof input.expectedVersion === "number" ? input.expectedVersion : undefined;
        const existing = await tx<
          { version: number }[]
        >`SELECT version FROM cloud_files WHERE workspace_id = ${workspaceId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND path = ${filePath} AND deleted_at IS NULL LIMIT 1`;
        if (existing[0] && expectedVersion !== undefined && existing[0].version !== expectedVersion)
          return response(
            request,
            { error: { code: "version_conflict", message: "Cloud file version conflict." } },
            409,
            id,
          );
        const rows = await tx`
          INSERT INTO cloud_files (id, organization_id, workspace_id, path, content, content_hash, version)
          VALUES (${crypto.randomUUID()}::uuid, ${tenant.organizationId}::uuid, ${workspaceId}::uuid, ${filePath}, ${content}, ${hashCloudFileContent(content)}, 1)
          ON CONFLICT (workspace_id, path) WHERE deleted_at IS NULL DO UPDATE SET content = EXCLUDED.content, content_hash = EXCLUDED.content_hash, version = cloud_files.version + 1, updated_at = now()
          RETURNING id, workspace_id, path, content, content_hash, version, created_at, updated_at
        `;
        return response(request, { file: rows[0] }, existing[0] ? 200 : 201, id);
      }
      if (request.method === "DELETE") {
        requireRole(tenant, "owner", "admin", "member");
        const rows =
          await tx`UPDATE cloud_files SET deleted_at = now(), updated_at = now() WHERE workspace_id = ${workspaceId}::uuid AND organization_id = ${tenant.organizationId}::uuid AND path = ${filePath} AND deleted_at IS NULL RETURNING id, path, version, deleted_at`;
        if (!rows[0])
          return response(
            request,
            { error: { code: "not_found", message: "File not found." } },
            404,
            id,
          );
        return response(request, { file: rows[0] }, 200, id);
      }
    }
    return response(request, { error: { code: "not_found", message: "Not found." } }, 404, id);
  });
}

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  async fetch(request) {
    const id = requestId(request);
    const { pathname } = new URL(request.url);
    const startedAt = performance.now();
    let status = 500;
    let identity: AuthenticatedIdentity | undefined;
    try {
      if (request.method === "OPTIONS") {
        status = 200;
        return response(request, null, status, id, {
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type,x-request-id",
          "access-control-max-age": "600",
        });
      }
      if (request.method === "GET" && pathname === "/healthz") {
        status = 200;
        return response(request, { status: "ok", service: "cortex-cloud-control" }, status, id);
      }
      if (request.method === "GET" && pathname === "/readyz") {
        await sql`SELECT 1`;
        status = 200;
        return response(request, { status: "ready", service: "cortex-cloud-control" }, status, id);
      }
      if (pathname.startsWith("/api/cloud/auth/")) {
        const result = await routeAuth(request, pathname, id);
        status = result.status;
        return result;
      }
      if (pathname.startsWith("/v1/")) {
        identity = await verifyCortexSession(request, sql, config.sessionCookieName);
        const result = await routeCloudApi(request, pathname, identity, id);
        status = result.status;
        return result;
      }
      status = 404;
      return response(request, { error: { code: "not_found", message: "Not found." } }, status, id);
    } catch (cause) {
      if (cause instanceof CloudAuthError) {
        status = cause.status;
        return response(
          request,
          { error: { code: cause.code, message: cause.message } },
          status,
          id,
        );
      }
      console.error(
        JSON.stringify({
          event: "cloud_request_failed",
          requestId: id,
          path: pathname,
          userId: identity?.userId,
          cause: String(cause),
        }),
      );
      status = 503;
      return response(
        request,
        { error: { code: "service_unavailable", message: "Service unavailable." } },
        status,
        id,
      );
    } finally {
      console.info(
        JSON.stringify({
          event: "cloud_request",
          requestId: id,
          method: request.method,
          path: pathname,
          userId: identity?.userId,
          status,
          durationMs: Math.round(performance.now() - startedAt),
        }),
      );
    }
  },
});

console.info(
  JSON.stringify({
    event: "cloud_control_started",
    host: server.hostname,
    port: server.port,
    environment: config.environment,
  }),
);
