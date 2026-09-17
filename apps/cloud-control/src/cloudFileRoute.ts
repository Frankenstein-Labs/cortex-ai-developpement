import { normalizeCloudFilePath } from "./cloudFiles";

/**
 * Decodes the file portion of a workspace endpoint exactly once before the
 * canonical path validator runs. URL.pathname intentionally preserves percent
 * escapes, so skipping this step makes files with spaces or Unicode impossible
 * to read after the browser encodes their URL.
 */
export function decodeCloudFileRoutePath(encodedPath: string): string {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    throw new Error("Cloud file path has invalid URL encoding.");
  }
  return normalizeCloudFilePath(`/${decodedPath}`);
}
