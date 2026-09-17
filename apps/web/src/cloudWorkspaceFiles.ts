export type CloudWorkspaceFileSummary = {
  id: string;
  workspace_id: string;
  path: string;
  content_hash: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type CloudWorkspaceFile = CloudWorkspaceFileSummary & {
  content: string;
};

/**
 * Converts a validated cloud file path into a URL path without allowing a path
 * segment to be interpreted as part of the control-plane route.
 */
export function cloudWorkspaceFilePath(workspaceId: string, filePath: string): string {
  if (!filePath.startsWith("/")) throw new Error("Cloud file paths must start with '/'.");
  const segments = filePath.slice(1).split("/");
  if (!segments.length || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Cloud file path is invalid.");
  }
  return `/v1/workspaces/${encodeURIComponent(workspaceId)}/files/${segments.map(encodeURIComponent).join("/")}`;
}
