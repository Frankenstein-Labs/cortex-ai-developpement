// Browser boundary for CORTEX Cloud control-plane resources.  Cloud pages must
// never fall back to local storage or the local desktop server when the remote
// service is unavailable.

export type CloudUser = { id: string; email: string; emailVerified: boolean };
export type CloudSession = { user: CloudUser; organizationId: string };
export type CloudOrganization = { id: string; name: string; slug: string; personal: boolean };
export type CloudProject = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  updated_at: string;
};
export type CloudWorkspace = {
  id: string;
  project_id: string | null;
  name: string;
  status: string;
  region: string;
  base_branch: string;
  work_branch: string;
  updated_at?: string;
};

export class CloudRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CloudRequestError";
    this.status = status;
  }
}

function cloudOrigin(): string {
  return import.meta.env.VITE_CLOUD_CONTROL_URL?.replace(/\/$/u, "") ?? "";
}

export async function cloudFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${cloudOrigin()}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new CloudRequestError(response.status, data?.error?.message ?? "Cloud request failed.");
  }
  return data as T;
}
