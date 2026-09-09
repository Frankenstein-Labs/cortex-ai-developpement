import { describe, expect, it } from "vitest";
import { hashCloudFileContent, nextCloudFileVersion, normalizeCloudFilePath } from "./cloudFiles";

describe("cloud files", () => {
  it("normalizes workspace-relative paths", () => {
    expect(normalizeCloudFilePath("/src/index.ts")).toBe("/src/index.ts");
  });

  it("rejects workspace escapes", () => {
    expect(() => normalizeCloudFilePath("/src/../secret")).toThrow("cannot escape");
  });

  it("hashes content deterministically", () => {
    expect(hashCloudFileContent("hello")).toBe(hashCloudFileContent("hello"));
  });

  it("detects optimistic concurrency conflicts", () => {
    expect(() => nextCloudFileVersion(3, 2)).toThrow("version conflict");
    expect(nextCloudFileVersion(3, 3)).toBe(4);
  });
});
