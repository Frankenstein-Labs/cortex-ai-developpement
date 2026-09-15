import { describe, expect, it } from "vitest";

import {
  digestSession,
  expiredSessionCookie,
  requireRole,
  sessionCookie,
  type TenantContext,
} from "./auth";

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
