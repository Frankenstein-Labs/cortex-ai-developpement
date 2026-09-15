import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { CloudRequestError, cloudFetch, type CloudWorkspace } from "~/cloudApi";

export const Route = createFileRoute("/cloud/workspaces/$workspaceId")({
  component: CloudWorkspacePage,
});

function CloudWorkspacePage() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<CloudWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const result = await cloudFetch<{ workspace: CloudWorkspace }>(
          `/v1/workspaces/${workspaceId}`,
          { signal: controller.signal },
        );
        if (!active) return;
        setWorkspace(result.workspace);
      } catch (cause) {
        if (!active || (cause instanceof DOMException && cause.name === "AbortError")) return;
        if (cause instanceof CloudRequestError && cause.status === 401) {
          await navigate({ to: "/login" });
          return;
        }
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Workspace could not be loaded.");
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [navigate, workspaceId]);

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
        {workspace ? (
          <>
            <p className="mt-8 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              CORTEX Cloud workspace
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{workspace.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {workspace.status} · {workspace.region} · {workspace.work_branch}
            </p>
            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">AI development</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                An AI runtime has not been provisioned for this Cloud workspace. CORTEX does not
                generate simulated assistant responses; connect the execution-plane runtime before
                starting a task.
              </p>
            </section>
          </>
        ) : error === null ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading workspace…</p>
        ) : null}
      </div>
    </main>
  );
}
