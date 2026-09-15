import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  CloudRequestError,
  cloudFetch,
  type CloudProject,
  type CloudWorkspace,
} from "~/cloudApi";

export const Route = createFileRoute("/cloud/projects/$projectId")({
  component: CloudProjectPage,
});

function CloudProjectPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<CloudProject | null>(null);
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const [projectResult, workspaceResult] = await Promise.all([
          cloudFetch<{ project: CloudProject }>(`/v1/projects/${projectId}`, {
            signal: controller.signal,
          }),
          cloudFetch<{ workspaces: CloudWorkspace[] }>(`/v1/projects/${projectId}/workspaces`, {
            signal: controller.signal,
          }),
        ]);
        if (!active) return;
        setProject(projectResult.project);
        setWorkspaces(workspaceResult.workspaces);
      } catch (cause) {
        if (!active || (cause instanceof DOMException && cause.name === "AbortError")) return;
        if (cause instanceof CloudRequestError && cause.status === 401) {
          await navigate({ to: "/login" });
          return;
        }
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Project could not be loaded.");
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [navigate, projectId]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Button render={<Link to="/cloud" />} variant="ghost">
          ← Projects
        </Button>
        {error ? (
          <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {project ? (
          <>
            <p className="mt-8 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              CORTEX Cloud project
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{project.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              /{project.slug}
              {project.description ? ` · ${project.description}` : ""}
            </p>
            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">Workspaces</h2>
              {workspaces.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No workspace has been provisioned for this project yet. Connect a repository
                  through the Cloud Control integration before creating one.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-border">
                  {workspaces.map((workspace) => (
                    <Link
                      className="flex items-center justify-between py-3 hover:underline"
                      key={workspace.id}
                      params={{ workspaceId: workspace.id }}
                      to="/cloud/workspaces/$workspaceId"
                    >
                      <span>{workspace.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {workspace.status} · Open workspace
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">Loading project…</p>
        )}
      </div>
    </main>
  );
}
