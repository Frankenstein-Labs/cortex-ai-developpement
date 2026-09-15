import { describe, expect, it, vi } from "vitest";

import { cloudFetch } from "./cloudApi";

describe("cloudFetch", () => {
  it("always sends credentialed JSON requests to the configured control plane", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ organizations: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cloudFetch("/v1/organizations");

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/organizations",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "content-type": "application/json" }),
      }),
    );
    vi.unstubAllGlobals();
  });
});
