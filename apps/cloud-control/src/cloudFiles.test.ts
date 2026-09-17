import { describe, expect, it } from "vitest";
import { hashCloudFileContent, nextCloudFileVersion, normalizeCloudFilePath } from "./cloudFiles";

describe("cloud files", () => {
  it("normalizes workspace-relative paths", () =>
    expect(normalizeCloudFilePath("/src/index.ts")).toBe("/src/index.ts"));
  it("rejects workspace escapes", () =>
    expect(() => normalizeCloudFilePath("/src/../secret")).toThrow("cannot escape"));
  it("rejects single-backslash traversal paths", () =>
    expect(() => normalizeCloudFilePath("/src\\..\\secret")).toThrow("forward slashes"));
  it("rejects control characters and paths beyond the database limit", () => {
    expect(() => normalizeCloudFilePath("/src/unsafe\u0000.ts")).toThrow("control characters");
    expect(() => normalizeCloudFilePath(`/${"a".repeat(4097)}`)).toThrow("4096");
  });
  it("hashes content deterministically", () =>
    expect(hashCloudFileContent("hello")).toBe(hashCloudFileContent("hello")));
  it("detects optimistic concurrency conflicts", () => {
    expect(() => nextCloudFileVersion(3, 2)).toThrow("version conflict");
    expect(nextCloudFileVersion(3, 3)).toBe(4);
  });
});
