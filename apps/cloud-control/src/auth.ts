import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SQL } from "bun";

export type AuthenticatedIdentity = Readonly<{
  userId: string;
  email: string;
  emailVerified: boolean;
  sessionId: string;
}>;

export type TenantContext = Readonly<{
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "member" | "viewer";
}>;

export function requireRole(tenant: TenantContext, ...allowed: TenantContext["role"][]): void {
  if (!allowed.includes(tenant.role)) {
    throw new CloudAuthError(403, "forbidden", "You do not have permission for this action.");
  }
}

export class CloudAuthError extends Error {
  readonly status: 400 | 401 | 403 | 409 | 501 | 503;
  readonly code: string;
  constructor(status: 400 | 401 | 403 | 409 | 501 | 503, code: string, message: string) {
    super(message);
    this.name = "CloudAuthError";
    this.status = status;
    this.code = code;
  }
}

export function digestSession(token: string): Uint8Array {
  return createHash("sha256").update("cortex-cloud-session:").update(token).digest();
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie") ?? "";
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const index = part.indexOf("=");
      if (index < 0) return [];
      return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
    }),
  );
}

export function readSessionToken(request: Request, cookieName: string): string | null {
  const token = parseCookies(request)[cookieName];
  return token?.trim() || null;
}

type CookieSameSite = "Lax" | "None";

export function sessionCookie(
  name: string,
  token: string,
  maxAge: number,
  secure: boolean,
  sameSite: CookieSameSite = "Lax",
): string {
  return `${name}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}`;
}

export function expiredSessionCookie(
  name: string,
  secure: boolean,
  sameSite: CookieSameSite = "Lax",
): string {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}`;
}

export async function verifyCortexSession(
  request: Request,
  sql: SQL,
  cookieName: string,
): Promise<AuthenticatedIdentity> {
  const token = readSessionToken(request, cookieName);
  if (!token) throw new CloudAuthError(401, "unauthorized", "Authentication required.");
  const rows = await sql<
    { session_id: string; user_id: string; email: string; email_verified: boolean }[]
  >`
    SELECT session_id, user_id, email, email_verified
    FROM app_resolve_web_session(${digestSession(token)})
    LIMIT 1
  `;
  const session = rows[0];
  if (!session) throw new CloudAuthError(401, "unauthorized", "Authentication required.");
  return {
    userId: session.user_id,
    email: session.email,
    emailVerified: session.email_verified,
    sessionId: session.session_id,
  };
}

export async function createCortexSession(
  sql: SQL,
  identity: Pick<AuthenticatedIdentity, "userId" | "email" | "emailVerified">,
  ttlSeconds: number,
): Promise<{ token: string; sessionId: string }> {
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('synara.user_id', ${identity.userId}, true)`;
    await tx`
      INSERT INTO web_sessions (id, user_id, token_hash, expires_at)
      VALUES (${sessionId}::uuid, ${identity.userId}::uuid, ${digestSession(token)}, ${expiresAt})
    `;
  });
  return { token, sessionId };
}

const SUPABASE_AUTH_TIMEOUT_MS = 10_000;

async function supabaseAuthRequest(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_AUTH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new CloudAuthError(503, "supabase_timeout", "Supabase authentication timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function supabasePasswordAuth(
  supabaseUrl: string,
  publishableKey: string,
  email: string,
  password: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; emailVerified: boolean };
}> {
  const response = await supabaseAuthRequest(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !response.ok ||
    typeof body?.access_token !== "string" ||
    !body.user ||
    typeof body.user !== "object"
  ) {
    throw new CloudAuthError(401, "invalid_credentials", "Email or password is incorrect.");
  }
  const user = body.user as { id?: string; email?: string; email_confirmed_at?: string | null };
  if (!user.id || !user.email)
    throw new CloudAuthError(401, "invalid_credentials", "Email or password is incorrect.");
  const result: {
    accessToken: string;
    user: { id: string; email: string; emailVerified: boolean };
    refreshToken?: string;
  } = {
    accessToken: body.access_token,
    user: { id: user.id, email: user.email, emailVerified: Boolean(user.email_confirmed_at) },
  };
  if (typeof body.refresh_token === "string") result.refreshToken = body.refresh_token;
  return result;
}

export async function supabaseSignup(
  supabaseUrl: string,
  publishableKey: string,
  email: string,
  password: string,
): Promise<{ accessToken?: string; userId: string; email: string; emailVerified: boolean }> {
  const response = await supabaseAuthRequest(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: publishableKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !body?.user || typeof body.user !== "object") {
    throw new CloudAuthError(400, "signup_failed", "Account creation could not be completed.");
  }
  const user = body.user as { id?: string; email?: string; email_confirmed_at?: string | null };
  if (!user.id || !user.email)
    throw new CloudAuthError(400, "signup_failed", "Account creation could not be completed.");
  const result: { userId: string; email: string; emailVerified: boolean; accessToken?: string } = {
    userId: user.id,
    email: user.email,
    emailVerified: Boolean(user.email_confirmed_at),
  };
  if (typeof body.access_token === "string") result.accessToken = body.access_token;
  return result;
}

export function createOAuthVerifier(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function supabaseOAuthExchange(
  supabaseUrl: string,
  publishableKey: string,
  code: string,
  verifier: string,
): Promise<{ user: { id: string; email: string; emailVerified: boolean } }> {
  const response = await supabaseAuthRequest(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { apikey: publishableKey, "content-type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const rawUser = body?.user;
  if (!response.ok || !rawUser || typeof rawUser !== "object") {
    throw new CloudAuthError(401, "oauth_exchange_failed", "OAuth sign-in could not be completed.");
  }
  const user = rawUser as { id?: string; email?: string; email_confirmed_at?: string | null };
  if (!user.id || !user.email) {
    throw new CloudAuthError(401, "oauth_exchange_failed", "OAuth account is missing an email.");
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: Boolean(user.email_confirmed_at),
    },
  };
}

export async function revokeCortexSession(sql: SQL, token: string): Promise<void> {
  await sql`SELECT app_revoke_web_session(${digestSession(token)})`;
}

export async function ensureCortexUser(
  sql: SQL,
  identity: Pick<AuthenticatedIdentity, "userId" | "email" | "emailVerified">,
): Promise<{ organizationId: string }> {
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('synara.user_id', ${identity.userId}, true)`;
    await tx`
      INSERT INTO users (id, email, email_verified_at)
      VALUES (${identity.userId}::uuid, ${identity.email}, ${identity.emailVerified ? new Date() : null})
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
        email_verified_at = COALESCE(users.email_verified_at, EXCLUDED.email_verified_at)
    `;
    const existing = await tx<{ id: string }[]>`
      SELECT id FROM organizations
      WHERE personal_owner_user_id = ${identity.userId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existing[0]?.id) return { organizationId: existing[0].id };
    const organizationId = randomUUID();
    const slug = `cortex-${identity.userId}`;
    const name = `${identity.email}'s Organization`;
    await tx`
      INSERT INTO organizations (id, slug, name, personal_owner_user_id)
      VALUES (${organizationId}::uuid, ${slug}, ${name}, ${identity.userId}::uuid)
    `;
    await tx`
      INSERT INTO memberships (organization_id, user_id, role)
      VALUES (${organizationId}::uuid, ${identity.userId}::uuid, 'owner')
    `;
    return { organizationId };
  });
}

export async function resolveTenantContext(
  sql: SQL,
  identity: AuthenticatedIdentity,
  requestedOrganizationId?: string,
): Promise<TenantContext> {
  if (
    requestedOrganizationId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      requestedOrganizationId,
    )
  ) {
    throw new CloudAuthError(
      400,
      "invalid_organization_id",
      "organizationId must be a valid UUID.",
    );
  }
  const rows = await sql<{ organization_id: string; role: TenantContext["role"] }[]>`
    SELECT organization_id, role::text AS role
    FROM memberships
    WHERE user_id = ${identity.userId}::uuid
      AND revoked_at IS NULL
      ${requestedOrganizationId ? sql`AND organization_id = ${requestedOrganizationId}::uuid` : sql``}
    ORDER BY created_at ASC
    LIMIT 1
  `;
  const membership = rows[0];
  if (!membership) throw new CloudAuthError(403, "forbidden", "No authorized organization.");
  return {
    userId: identity.userId,
    organizationId: membership.organization_id,
    role: membership.role,
  };
}

export async function withTenantTransaction<T>(
  sql: SQL,
  tenant: TenantContext,
  callback: (tx: SQL) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('synara.user_id', ${tenant.userId}, true)`;
    await tx`SELECT set_config('synara.organization_id', ${tenant.organizationId}, true)`;
    return callback(tx);
  });
}
