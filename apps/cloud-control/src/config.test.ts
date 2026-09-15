import { describe, expect, it } from "vitest";

import { loadCloudControlConfig } from "./config";

describe("loadCloudControlConfig", () => {
  it("rejects missing and non-PostgreSQL database URLs", () => {
    expect(() => loadCloudControlConfig({})).toThrow("CORTEX_DATABASE_URL");
    expect(() => loadCloudControlConfig({ CORTEX_DATABASE_URL: "https://example.test" })).toThrow(
      "must use the postgres or postgresql protocol.",
    );
  });

  it("parses a bounded listener configuration", () => {
    expect(
      loadCloudControlConfig({
        CORTEX_DATABASE_URL: "postgresql://app:secret@db.example/cortex",
        SUPABASE_URL: "https://ownnbyhsflmdjytwaeqv.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        PORT: "9443",
        CORTEX_ENVIRONMENT: "staging",
      }),
    ).toMatchObject({ host: "0.0.0.0", port: 9443, environment: "staging" });
  });

  it("requires explicit browser origins in production", () => {
    const base = {
      CORTEX_DATABASE_URL: "postgresql://app:secret@db.example/cortex",
      SUPABASE_URL: "https://ownnbyhsflmdjytwaeqv.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      CORTEX_ENVIRONMENT: "production",
    };
    expect(() => loadCloudControlConfig(base)).toThrow("CORTEX_ALLOWED_ORIGINS");
    expect(
      loadCloudControlConfig({ ...base, CORTEX_ALLOWED_ORIGINS: "https://cloud.example" }),
    ).toMatchObject({
      allowedOrigins: ["https://cloud.example"],
    });
  });
});
