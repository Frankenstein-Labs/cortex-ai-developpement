export type CloudProject = Readonly<{
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
}>;

export type CloudWorkspace = Readonly<{
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  status: "provisioning" | "ready" | "suspended" | "destroyed";
}>;

export type CloudFile = Readonly<{
  id: string;
  organizationId: string;
  workspaceId: string;
  path: string;
  content: string;
  contentHash: string;
  version: number;
}>;

export type CloudFileChange = Readonly<{
  path: string;
  content: string;
  expectedVersion?: number;
}>;
