import { createHash } from "node:crypto";

export function normalizeCloudFilePath(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error("Cloud file paths must be absolute.");
  }
  if (path.includes("\\\\")) {
    throw new Error("Cloud file paths must use forward slashes.");
  }
  const parts = path.split("/");
  if (parts.some((part) => part === "..")) {
    throw new Error("Cloud file paths cannot escape the workspace.");
  }
  const normalized = parts.filter(Boolean).join("/");
  if (normalized.length === 0) {
    throw new Error("Cloud file path cannot be the workspace root.");
  }
  return `/${normalized}`;
}

export function hashCloudFileContent(content: string): string {
  return createHash("sha256")
    .update("cortex-cloud-file:v1:")
    .update(content, "utf8")
    .digest("hex");
}

export function nextCloudFileVersion(
  currentVersion: number,
  expectedVersion?: number,
): number {
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 1) {
    throw new Error("Invalid current file version.");
  }
  if (
    expectedVersion !== undefined &&
    expectedVersion !== currentVersion
  ) {
    throw new Error("Cloud file version conflict.");
  }
  return currentVersion + 1;
}
