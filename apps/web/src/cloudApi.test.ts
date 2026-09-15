import { afterEach, describe, expect, it, vi } from "vitest";

import { CloudConfigurationError, cloudFetch, resolveCloudControlUrl } from "./cloudApi";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cloudFetch", () => {
  it("always sends credentialed JSON requests to the configured control plane", async () => {
    vi.stubEnv("VITE_CLOUD_CONTROL_URL", "https://control.example/");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ organizations: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await cloudFetch("/v1/organizations");

    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(request).toEqual(expect.objectContaining({ credentials: "include" }));
    expect(new Headers(request?.headers).get("content-type")).toBe("application/json");
  });

  it("preserves HeadersInit values while adding a missing JSON content type", async () => {
    vi.stubEnv("VITE_CLOUD_CONTROL_URL", "https://control.example");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ organizations: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await cloudFetch("/v1/organizations", {
      headers: [["x-request-id", "fixture"]],
    });

    const [, request] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(request?.headers);
    expect(headers.get("x-request-id")).toBe("fixture");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("accepts and normalizes an absolute Cloud Control URL", () => {
    expect(resolveCloudControlUrl("  https://control.example/api/  ", true)).toBe(
      "https://control.example/api",
    );
  });

  it.each([undefined, "", "   ", "/api/cloud", "mailto:ops@example.test"])(
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

  it.each([
    "https://control.example?tenant=fixture",
    "https://user:secret@control.example",
    "https://control.example/v1#fragment",
  ])("rejects unsafe URL components: %s", (value) => {
    expect(() => resolveCloudControlUrl(value, false)).toThrow(CloudConfigurationError);
  });
});
