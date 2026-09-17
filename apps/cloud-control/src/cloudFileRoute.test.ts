import { describe, expect, it } from "vitest";

import { decodeCloudFileRoutePath } from "./cloudFileRoute";

describe("decodeCloudFileRoutePath", () => {
  it("decodes browser-encoded segments before lookup", () => {
    expect(decodeCloudFileRoutePath("src/a%20file%20%C3%A9.ts")).toBe("/src/a file é.ts");
  });

  it("rejects malformed encodings and encoded traversal", () => {
    expect(() => decodeCloudFileRoutePath("src/%E0%A4%A")).toThrow("encoding");
    expect(() => decodeCloudFileRoutePath("src/%2E%2E/secret")).toThrow("cannot escape");
    expect(() => decodeCloudFileRoutePath("src/%5C..%5Csecret")).toThrow("forward slashes");
  });
});
