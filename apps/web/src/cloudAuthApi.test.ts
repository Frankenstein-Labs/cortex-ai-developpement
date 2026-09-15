import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudAuthGateway, CloudAuthRequestError } from "./cloudAuthApi";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CloudAuthRequestError", () => {
  it("is distinguishable from an unexpected browser failure", () => {
    expect(new CloudAuthRequestError("Invalid credentials")).toMatchObject({
      message: "Invalid credentials",
      name: "CloudAuthRequestError",
    });
  });

  it("fails closed instead of sending auth requests to the hosting origin", async () => {
    vi.stubEnv("VITE_CLOUD_CONTROL_URL", "   ");

    await expect(
      cloudAuthGateway.submit("login", {
        email: "user@example.test",
        password: "not-a-real-password",
        acceptedTerms: false,
      }),
    ).rejects.toMatchObject({
      name: "CloudConfigurationError",
      message: "VITE_CLOUD_CONTROL_URL must be configured.",
    });
  });
});
