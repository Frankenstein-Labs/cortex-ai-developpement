// FILE: config.ts
// Purpose: Fail-fast configuration boundary for the independently deployable cloud control plane.

export type CloudControlConfig = Readonly<{
  host: string;
  port: number;
  databaseUrl: string;
  environment: "development" | "staging" | "production";
  supabaseUrl: string;
  supabasePublishableKey: string;
  sessionCookieName: string;
  sessionTtlSeconds: number;
  cookieSecure: boolean;
  cookieSameSite: "Lax" | "None";
  allowedOrigins: readonly string[];
}>;

const environments = new Set(["development", "staging", "production"]);

export function loadCloudControlConfig(
  env: Record<string, string | undefined>,
): CloudControlConfig {
  const databaseUrl = env.CORTEX_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("CORTEX_DATABASE_URL is required.");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("CORTEX_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("CORTEX_DATABASE_URL must use the postgres or postgresql protocol.");
  }

  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/$/u, "");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is required.");
  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL.");
  }
  if (parsedSupabaseUrl.protocol !== "https:" && parsedSupabaseUrl.hostname !== "localhost") {
    throw new Error("SUPABASE_URL must use HTTPS.");
  }
  const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabasePublishableKey) throw new Error("SUPABASE_PUBLISHABLE_KEY is required.");
  if (
    supabasePublishableKey.startsWith("sb_secret_") ||
    supabasePublishableKey.includes("service_role")
  ) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY must not be a secret or service-role key.");
  }

  const portValue = env.PORT?.trim() ?? "8787";
  const port = Number(portValue);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const environment = env.CORTEX_ENVIRONMENT?.trim() ?? "development";
  if (!environments.has(environment)) {
    throw new Error("CORTEX_ENVIRONMENT must be development, staging, or production.");
  }
  const sessionTtlSeconds = Number(env.CORTEX_SESSION_TTL_SECONDS ?? "604800");
  if (!Number.isSafeInteger(sessionTtlSeconds) || sessionTtlSeconds < 300) {
    throw new Error("CORTEX_SESSION_TTL_SECONDS must be at least 300 seconds.");
  }
  const cookieSecure = env.CORTEX_COOKIE_SECURE?.trim() !== "false";
  if (environment === "production" && !cookieSecure) {
    throw new Error("CORTEX_COOKIE_SECURE must not be false in production.");
  }
  const cookieSameSiteValue = env.CORTEX_COOKIE_SAMESITE?.trim().toLowerCase() ?? "lax";
  if (cookieSameSiteValue !== "lax" && cookieSameSiteValue !== "none") {
    throw new Error("CORTEX_COOKIE_SAMESITE must be lax or none.");
  }
  const cookieSameSite = cookieSameSiteValue === "none" ? "None" : "Lax";
  if (cookieSameSite === "None" && !cookieSecure) {
    throw new Error("CORTEX_COOKIE_SAMESITE=none requires secure cookies.");
  }
  const allowedOrigins = (env.CORTEX_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/u, ""))
    .filter(Boolean);
  if (environment === "production" && allowedOrigins.length === 0) {
    throw new Error("CORTEX_ALLOWED_ORIGINS is required in production.");
  }
  for (const origin of allowedOrigins) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error("CORTEX_ALLOWED_ORIGINS entries must be valid origins.");
    }
    if (
      parsedOrigin.origin !== origin ||
      parsedOrigin.pathname !== "/" ||
      parsedOrigin.search ||
      parsedOrigin.hash
    ) {
      throw new Error("CORTEX_ALLOWED_ORIGINS entries must be origins without a path.");
    }
    if (environment === "production" && parsedOrigin.protocol !== "https:") {
      throw new Error("CORTEX_ALLOWED_ORIGINS entries must use HTTPS in production.");
    }
  }

  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port,
    databaseUrl,
    environment: environment as CloudControlConfig["environment"],
    supabaseUrl,
    supabasePublishableKey,
    sessionCookieName: env.CORTEX_SESSION_COOKIE?.trim() || "cortex_cloud_session",
    sessionTtlSeconds,
    cookieSecure,
    cookieSameSite,
    allowedOrigins,
  };
}
