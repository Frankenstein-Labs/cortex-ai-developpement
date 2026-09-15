import { afterEach, describe, expect, it, vi } from "vitest";

import {
  digestSession,
  expiredSessionCookie,
  requireRole,
  sessionCookie,
  supabasePasswordAuth,
  type TenantContext,
} from "./auth";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("opaque CORTEX sessions", () => {
  it("hashes the same token deterministically without returning the raw value", () => {
    const first = digestSession("opaque-example");
    const second = digestSession("opaque-example");
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(Buffer.from(first).toString("utf8")).not.toContain("opaque-example");
  });

  it("emits HttpOnly secure cookies and an idempotent expiry cookie", () => {
    expect(sessionCookie("cortex_cloud_session", "raw-only-in-memory", 300, true)).toContain(
      "HttpOnly",
    );
    expect(sessionCookie("cortex_cloud_session", "raw-only-in-memory", 300, true)).toContain(
      "Secure",
    );
    expect(expiredSessionCookie("cortex_cloud_session", true)).toContain("Max-Age=0");
  });

  it("uses None only when explicitly requested for cross-site deployments", () => {
    expect(sessionCookie("cortex_cloud_session", "token", 300, true, "None")).toContain(
      "SameSite=None; Secure",
    );
    expect(expiredSessionCookie("cortex_cloud_session", true, "None")).toContain(
      "SameSite=None; Secure",
    );
  });

  it("applies a deadline to Supabase password authentication", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
    );
    const pending = supabasePasswordAuth(
      "https://supabase.example",
      "publishable",
      "a@b.test",
      "password",
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toMatchObject({
      status: 503,
      code: "supabase_timeout",
    });
  });
});

describe("requireRole", () => {
  const tenant: TenantContext = { userId: "user-a", organizationId: "org-a", role: "member" };

  it("allows roles explicitly granted to a route", () => {
    expect(() => requireRole(tenant, "owner", "admin", "member")).not.toThrow();
  });

  it("rejects a viewer/member from an administrative route", () => {
    expect(() => requireRole(tenant, "owner", "admin")).toThrow(
      "You do not have permission for this action.",
    );
  });
});
