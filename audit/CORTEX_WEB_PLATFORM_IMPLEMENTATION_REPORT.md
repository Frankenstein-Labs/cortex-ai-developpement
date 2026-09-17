# CORTEX WEB PLATFORM — IMPLEMENTATION REPORT

**Report date:** 2026-09-17  
**Scope:** evidence-based implementation increment for the existing CORTEX repository.

## 1. Repository audit — DONE

- `apps/web` is the React/Vite browser application. It already includes chat, files, editor,
  terminal, Git, diff, pull-request, and provider-session UI for the local-first product.
- `apps/server` is the local Node/Bun WebSocket runtime and Codex app-server broker. It owns
  local orchestration, workspace filesystem protections, managed worktrees, terminals, and Git.
- `apps/cloud-control` is the independently deployable Bun/PostgreSQL cloud control plane.
  It owns opaque browser sessions, organization resolution, project/workspace metadata, and
  cloud-file persistence; it is not imported into the local runtime.
- `packages/contracts` contains schema-only protocol/domain contracts; `packages/shared`
  contains shared runtime utilities. `apps/desktop` remains a supported Electron packaging
  surface rather than a deleted legacy path.

## 2. Architecture before — DONE

The cloud workspace route could retrieve one workspace record but deliberately offered no file
surface and stated that an AI runtime was absent. The control plane already exposed tenant-scoped
file list/read/write endpoints with SHA-256 content hashes, soft deletion, RLS, and optimistic
version checks.

## 3. Architecture after — PARTIAL

The web workspace route now consumes those existing authenticated file endpoints as a real
file tree and editor. Reads and writes go to the cloud control plane; saves include the retrieved
version and surface a conflict instead of silently overwriting another edit. No local-storage or
simulated workspace fallback was added.

## 4. Features migrated — PARTIAL

Cloud workspace file editing is now a browser-first surface. The established local desktop
workspace functionality remains intact and has not been removed or treated as a cloud runtime.

## 5. Features implemented — DONE

- Workspace file listing, opening, text editing, and persistence through existing CORTEX Cloud
  APIs.
- Per-segment URL encoding for cloud paths, with local rejection of relative and traversal paths.
- Optimistic-concurrency save handling and a clear conflict recovery message.
- Documentation describing the actual cloud boundary rather than promising simulated AI/runtime
  behavior.

## 6. Features intentionally removed — NOT IMPLEMENTED

No functional paths were removed.

## 7. Desktop code migrated/removed — NOT IMPLEMENTED

Desktop remains a supported product surface. No desktop-only code was removed in this increment.

## 8. CORTEX AI integration — BLOCKED

The cloud control plane intentionally has no `/v1/ai/*` route. A hosted agent must wait for
identity, quota, audit, and execution-plane controls; the browser does not generate mock output.
Local CORTEX provider sessions remain available through `apps/server`.

## 9. CORTEX Engine integration — BLOCKED

There is no hosted runner registration, lease, sandbox, or execution transport. The repository's
local server/orchestration runtime remains separate from Cloud Control by design.

## 10. Database changes — NOT IMPLEMENTED

No migration was required: the implementation reuses `cloud_files` and its existing organization,
workspace, hash, version, soft-delete, indexes, composite foreign key, and forced-RLS constraints.

## 11. API changes — NOT IMPLEMENTED

No control-plane API was added. The web route uses the existing authenticated
`/v1/workspaces/:id/files` list/read/write API.

## 12. Security changes — DONE

The client encodes each requested file-path segment and refuses relative/traversal paths before
forming a request. The server remains the authority: it normalizes paths, authenticates sessions,
scopes every query by organization/workspace, enforces roles for writes, and rejects stale versions.

## 13. Tests executed — PARTIAL

A focused unit test was added for safe cloud-file URL construction. The requested Bun test command
could not execute because the environment has only a Mise Bun shim and its configured Bun download
was unavailable through the network tunnel. See the change/PR verification output for the exact
failed environmental command.

## 14. E2E results — BLOCKED

No browser E2E run was possible without a reachable Supabase/PostgreSQL-backed Cloud Control
deployment and the unavailable Bun runtime. No E2E success is claimed.

## 15. Build results — BLOCKED

Not run because the required Bun 1.4.2 runtime could not be downloaded in this environment.

## 16. Deployment status — PARTIAL

Cloud Control remains separately deployable with the documented PostgreSQL and Supabase variables.
This increment does not add infrastructure, a migration runner, or a hosted execution plane.

## 17. Remaining limitations — PARTIAL

- No cloud repository connection UI or repository-provisioning workflow.
- No runner-backed workspace lifecycle, terminal, Git, diff, commit, or pull-request execution.
- No hosted CORTEX AI/task/agent API or streaming integration.
- The editor is a reliable persisted text surface, not yet a language-service/Monaco-equivalent IDE.

## 18. Recommended next steps — DONE

1. Implement one lease-fenced, isolated runner protocol before exposing hosted execution.
2. Connect repository provisioning to the existing control-plane workspace records using
   short-lived installation credentials and redaction.
3. Add durable task/outbox/event replay semantics before cloud AI streaming.
4. Build terminal, Git, diff, commit, and pull-request surfaces only once their runner-backed
   APIs and authorization tests exist.
5. Run the full formatter, lint, typecheck, tests, build, and browser journey against a disposable
   cloud environment once Bun/network dependencies are available.
