import { afterEach, describe, expect, it, vi } from "vitest";

import { CloudConfigurationError, cloudFetch, resolveCloudControlUrl } from "./cloudApi";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cloudFetch", () => {
  it("always sends credentialed JSON requests to the configured control plane", async () => {
    vi.stubEnv("VITE_CLOUD_CONTROL_URL", "https://control.example/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ organizations: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cloudFetch("/v1/organizations");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://control.example/v1/organizations",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "content-type": "application/json" }),
      }),
    );
  });

  it("accepts and normalizes an absolute Cloud Control URL", () => {
    expect(resolveCloudControlUrl("  https://control.example/api/  ", true)).toBe(
      "https://control.example/api",
    );
  });

  it.each([undefined, "", "   ", "/api/cloud", "mailto:ops@example.test"]) (
    "rejects an absent or invalid Cloud Control URL: %j",
    (value) => {
      expect(() => resolveCloudControlUrl(value, false)).toThrow(CloudConfigurationError);
    },
  );

  it("rejects insecure Cloud Control URLs in production", () => {
    expect(() => resolveCloudControlUrl("http://control.example", true)).toThrow(
      "must use HTTPS in production",
    );
  });
});
