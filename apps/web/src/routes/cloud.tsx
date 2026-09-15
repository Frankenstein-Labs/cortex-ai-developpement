import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  CloudRequestError,
  cloudFetch,
  type CloudOrganization,
  type CloudProject,
  type CloudSession,
} from "~/cloudApi";

export const Route = createFileRoute("/cloud")({ component: CloudDashboard });

function CloudDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<CloudSession | null>(null);
  const [organizations, setOrganizations] = useState<CloudOrganization[]>([]);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const current = await cloudFetch<CloudSession>("/api/cloud/auth/session");
      const [orgs, projectList] = await Promise.all([
        cloudFetch<{ organizations: CloudOrganization[] }>("/v1/organizations"),
        cloudFetch<{ projects: CloudProject[] }>("/v1/projects"),
      ]);
      setSession(current);
      setOrganizations(orgs.organizations);
      setProjects(projectList.projects);
      setError(null);
    } catch (cause) {
      if (cause instanceof CloudRequestError && cause.status === 401) {
        await navigate({ to: "/login" });
        return;
      }
      setError(cause instanceof Error ? cause.message : "Cloud session could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await cloudFetch("/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project could not be created.");
    }
  }

  async function logout() {
    await cloudFetch("/api/cloud/auth/logout", { method: "POST" }).catch(() => undefined);
    await navigate({ to: "/login" });
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading CORTEX Cloud…
      </main>
    );
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              CORTEX Cloud
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your cloud workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">{session?.user.email}</p>
          </div>
          <Button variant="outline" onClick={logout}>
            Sign out
          </Button>
        </header>
        {error ? (
          <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Organization</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your tenant context is resolved by Cloud Control.
            </p>
            <div className="mt-5 space-y-2">
              {organizations.map((organization) => (
                <div className="rounded-lg border border-border/70 p-3" key={organization.id}>
                  <p className="font-medium">{organization.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {organization.slug}
                    {organization.personal ? " · Personal" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Projects</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Projects are loaded from the authenticated CORTEX tenant.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{projects.length} total</span>
            </div>
            <form className="mt-5 flex gap-2" onSubmit={createProject}>
              <Label className="sr-only" htmlFor="project-name">
                Project name
              </Label>
              <Input
                id="project-name"
                placeholder="New project name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit">Create</Button>
            </form>
            <div className="mt-5 divide-y divide-border rounded-lg border border-border/70">
              {projects.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No projects yet.</p>
              ) : (
                projects.map((project) => (
                  <div className="flex items-center justify-between gap-3 p-4" key={project.id}>
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">/{project.slug}</p>
                    </div>
                    <Link
                      className="text-sm underline-offset-4 hover:underline"
                      params={{ projectId: project.id }}
                      to="/cloud/projects/$projectId"
                    >
                      Open
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
