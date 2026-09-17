import { afterEach, describe, expect, it, vi } from "vitest";

import { CloudAuthRequestError, cloudAuthGateway } from "./cloudAuthApi";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CloudAuthRequestError", () => {
  it("is distinguishable from an unexpected browser failure", () => {
    expect(new CloudAuthRequestError("Invalid credentials")).toMatchObject({
      message: "Invalid credentials",
      name: "CloudAuthRequestError",
    });
  });
});

describe("cloudAuthGateway", () => {
  it("fails clearly before sending a relative request when the control plane is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_CLOUD_CONTROL_URL", "");

    await expect(
      cloudAuthGateway.submit("login", {
        email: "user@example.com",
        password: "password",
        acceptedTerms: false,
      }),
    ).rejects.toThrow("VITE_CLOUD_CONTROL_URL must be configured.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
