// FILE: index.ts
// Purpose: CORTEX Cloud control-plane HTTP boundary.
import { SQL } from "bun";
import { loadCloudControlConfig } from "./config";
import {
  CloudAuthError,
  ensureCortexUser,
  resolveTenantContext,
  sessionCookie,
  expiredSessionCookie,
  supabasePasswordAuth,
  supabaseSignup,
  verifySupabaseToken,
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
  body: unknown,
  status: number,
  id: string,
  extraHeaders: HeadersInit = {},
): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-request-id": id, ...extraHeaders },
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

function authSession(identity: AuthenticatedIdentity, organizationId: string) {
  return {
    user: { id: identity.userId, email: identity.email, emailVerified: identity.emailVerified },
    organizationId,
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
      sessionToken: result.accessToken ?? "",
      sessionId: crypto.randomUUID(),
    };
    const { organizationId } = await ensureCortexUser(sql, identity);
    if (!result.accessToken) {
      return response(
        { status: "email_verification_required", ...authSession(identity, organizationId) },
        202,
        id,
      );
    }
    return response(authSession(identity, organizationId), 201, id, {
      "set-cookie": sessionCookie(
        config.sessionCookieName,
        result.accessToken,
        config.sessionTtlSeconds,
        config.cookieSecure,
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
      sessionToken: result.accessToken,
      sessionId: crypto.randomUUID(),
    };
    const { organizationId } = await ensureCortexUser(sql, identity);
    return response(authSession(identity, organizationId), 200, id, {
      "set-cookie": sessionCookie(
        config.sessionCookieName,
        result.accessToken,
        config.sessionTtlSeconds,
        config.cookieSecure,
      ),
    });
  }

  if (request.method === "GET" && pathname === "/api/cloud/auth/session") {
    const identity = await verifySupabaseToken(
      request,
      config.supabaseUrl,
      config.supabasePublishableKey,
      config.sessionCookieName,
    );
    const { organizationId } = await ensureCortexUser(sql, identity);
    return response(authSession(identity, organizationId), 200, id);
  }

  if (request.method === "POST" && pathname === "/api/cloud/auth/logout") {
    return response({ revoked: true }, 200, id, {
      "set-cookie": expiredSessionCookie(config.sessionCookieName, config.cookieSecure),
    });
  }

  if (request.method === "GET" && pathname.startsWith("/api/cloud/auth/oauth/")) {
    throw new CloudAuthError(
      501,
      "oauth_not_configured",
      "OAuth provider configuration is required.",
    );
  }
  return response({ error: { code: "not_found", message: "Not found." } }, 404, id);
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
      return response({ organizations }, 200, id);
    }
    if (request.method === "GET" && pathname === "/v1/projects") {
      const projects = await tx`
        SELECT id, organization_id, name, slug, description, created_by_user_id, created_at, updated_at
        FROM projects WHERE organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL
        ORDER BY updated_at DESC
      `;
      return response({ projects }, 200, id);
    }
    if (request.method === "POST" && pathname === "/v1/projects") {
      const input = await body(request);
      const name = textField(input.name, "name");
      const slug = textField(input.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/gu, "-"), "slug");
      const description =
        typeof input.description === "string" ? input.description.trim() || null : null;
      const projectId = crypto.randomUUID();
      const rows = await tx`
        INSERT INTO projects (id, organization_id, name, slug, description, created_by_user_id)
        VALUES (${projectId}::uuid, ${tenant.organizationId}::uuid, ${name}, ${slug}, ${description}, ${tenant.userId}::uuid)
        RETURNING id, organization_id, name, slug, description, created_by_user_id, created_at, updated_at
      `;
      return response({ project: rows[0] }, 201, id);
    }
    const projectMatch = pathname.match(/^\/v1\/projects\/([0-9a-f-]{36})$/u);
    if (request.method === "GET" && projectMatch) {
      const rows = await tx`
        SELECT id, organization_id, name, slug, description, created_by_user_id, created_at, updated_at
        FROM projects WHERE id = ${projectMatch[1]}::uuid AND organization_id = ${tenant.organizationId}::uuid AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!rows[0])
        return response({ error: { code: "not_found", message: "Project not found." } }, 404, id);
      return response({ project: rows[0] }, 200, id);
    }
    return response({ error: { code: "not_found", message: "Not found." } }, 404, id);
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
      if (request.method === "GET" && pathname === "/healthz") {
        status = 200;
        return response({ status: "ok", service: "cortex-cloud-control" }, status, id);
      }
      if (request.method === "GET" && pathname === "/readyz") {
        await sql`SELECT 1`;
        status = 200;
        return response({ status: "ready", service: "cortex-cloud-control" }, status, id);
      }
      if (pathname.startsWith("/api/cloud/auth/")) {
        const result = await routeAuth(request, pathname, id);
        status = result.status;
        return result;
      }
      if (pathname.startsWith("/v1/")) {
        identity = await verifySupabaseToken(
          request,
          config.supabaseUrl,
          config.supabasePublishableKey,
          config.sessionCookieName,
        );
        const result = await routeCloudApi(request, pathname, identity, id);
        status = result.status;
        return result;
      }
      status = 404;
      return response({ error: { code: "not_found", message: "Not found." } }, status, id);
    } catch (cause) {
      if (cause instanceof CloudAuthError) {
        status = cause.status;
        return response({ error: { code: cause.code, message: cause.message } }, status, id);
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
