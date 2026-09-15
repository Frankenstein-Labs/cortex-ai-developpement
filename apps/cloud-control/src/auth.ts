import { createHash, randomUUID } from "node:crypto";
import type { SQL } from "bun";

export type AuthenticatedIdentity = Readonly<{
  userId: string;
  email: string;
  emailVerified: boolean;
  sessionToken: string;
  sessionId: string;
}>;

export type TenantContext = Readonly<{
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "member" | "viewer";
}>;

export class CloudAuthError extends Error {
  readonly status: 400 | 401 | 403 | 501;
  readonly code: string;
  constructor(status: 400 | 401 | 403 | 501, code: string, message: string) {
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

export function sessionCookie(
  name: string,
  token: string,
  maxAge: number,
  secure: boolean,
): string {
  return `${name}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function expiredSessionCookie(name: string, secure: boolean): string {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export async function verifySupabaseToken(
  request: Request,
  supabaseUrl: string,
  publishableKey: string,
  cookieName: string,
): Promise<AuthenticatedIdentity> {
  const token = readSessionToken(request, cookieName);
  if (!token) throw new CloudAuthError(401, "unauthorized", "Authentication required.");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new CloudAuthError(401, "unauthorized", "Authentication required.");
  const user = (await response.json()) as {
    id?: string;
    email?: string;
    email_confirmed_at?: string | null;
  };
  if (!user.id || !user.email)
    throw new CloudAuthError(401, "unauthorized", "Authentication required.");
  return {
    userId: user.id,
    email: user.email,
    emailVerified: Boolean(user.email_confirmed_at),
    sessionToken: token,
    sessionId: randomUUID(),
  };
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
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
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
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
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
    const slug = `cortex-${identity.userId.slice(0, 8)}`;
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
