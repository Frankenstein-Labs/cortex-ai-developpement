import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  cloudWorkspaceFilePath,
  type CloudWorkspaceFile,
  type CloudWorkspaceFileSummary,
} from "~/cloudWorkspaceFiles";
import { CloudRequestError, cloudFetch, type CloudWorkspace } from "~/cloudApi";

export const Route = createFileRoute("/cloud/workspaces/$workspaceId")({
  component: CloudWorkspacePage,
});

function CloudWorkspacePage() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<CloudWorkspace | null>(null);
  const [files, setFiles] = useState<CloudWorkspaceFileSummary[]>([]);
  const [activeFile, setActiveFile] = useState<CloudWorkspaceFile | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const [result, fileResult] = await Promise.all([
          cloudFetch<{ workspace: CloudWorkspace }>(`/v1/workspaces/${workspaceId}`, {
            signal: controller.signal,
          }),
          cloudFetch<{ files: CloudWorkspaceFileSummary[] }>(
            `/v1/workspaces/${workspaceId}/files`,
            { signal: controller.signal },
          ),
        ]);
        if (!active) return;
        setWorkspace(result.workspace);
        setFiles(fileResult.files);
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

  async function openFile(file: CloudWorkspaceFileSummary) {
    setLoadingFile(true);
    try {
      const result = await cloudFetch<{ file: CloudWorkspaceFile }>(
        cloudWorkspaceFilePath(workspaceId, file.path),
      );
      setActiveFile(result.file);
      setDraft(result.file.content);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File could not be opened.");
    } finally {
      setLoadingFile(false);
    }
  }

  async function saveFile() {
    if (!activeFile || draft === activeFile.content) return;
    setSaving(true);
    try {
      const result = await cloudFetch<{ file: CloudWorkspaceFile }>(
        cloudWorkspaceFilePath(workspaceId, activeFile.path),
        {
          method: "PUT",
          body: JSON.stringify({ content: draft, expectedVersion: activeFile.version }),
        },
      );
      setActiveFile(result.file);
      setDraft(result.file.content);
      setFiles((current) =>
        current.map((file) => (file.path === result.file.path ? result.file : file)),
      );
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof CloudRequestError && cause.status === 409
          ? "This file changed elsewhere. Reopen it before saving your changes."
          : cause instanceof Error
            ? cause.message
            : "File could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
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
            <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-semibold">Workspace files</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Files are persisted in the authenticated workspace with version checks on save.
                  </p>
                </div>
                {activeFile ? (
                  <Button disabled={saving || draft === activeFile.content} onClick={() => void saveFile()}>
                    {saving ? "Saving…" : "Save file"}
                  </Button>
                ) : null}
              </div>
              <div className="grid min-h-[28rem] md:grid-cols-[15rem_minmax(0,1fr)]">
                <aside className="border-b border-border bg-muted/20 p-3 md:border-r md:border-b-0">
                  <p className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Files
                  </p>
                  {files.length === 0 ? (
                    <p className="px-2 text-sm text-muted-foreground">No persisted files yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {files.map((file) => (
                        <button
                          className="block w-full rounded-md px-2 py-1.5 text-left font-mono text-xs hover:bg-muted data-[active=true]:bg-muted"
                          data-active={activeFile?.path === file.path}
                          key={file.id}
                          onClick={() => void openFile(file)}
                          type="button"
                        >
                          {file.path}
                        </button>
                      ))}
                    </div>
                  )}
                </aside>
                <div className="flex min-w-0 flex-col">
                  {activeFile ? (
                    <>
                      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
                        <span className="truncate font-mono">{activeFile.path}</span>
                        <span>v{activeFile.version}{draft !== activeFile.content ? " · modified" : ""}</span>
                      </div>
                      <textarea
                        aria-label={`Edit ${activeFile.path}`}
                        className="min-h-[24rem] flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 outline-none"
                        onChange={(event) => setDraft(event.target.value)}
                        spellCheck={false}
                        value={draft}
                      />
                    </>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                      {loadingFile ? "Opening file…" : "Select a file to edit it."}
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section className="mt-5 rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">CORTEX AI</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                No execution-plane runtime is connected to this workspace yet. CORTEX will not
                simulate agent output, terminal commands, or Git operations until that secure
                runtime is available.
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
