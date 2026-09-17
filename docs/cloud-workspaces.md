# CORTEX Cloud Workspaces

Cloud workspaces are organization-scoped metadata records associated with a project and connected
repository. The current control plane can list/read/update workspace metadata and persist cloud
files. The Web workspace surface lists files, opens text files, and saves through optimistic
concurrency.

## What is available

- authenticated project and workspace lookup;
- tenant-scoped cloud file listing, reading, writing, soft deletion, SHA-256 content hashes, and
  monotonically increasing versions;
- browser editor save conflict feedback.

## What is not available yet

Workspace status does not prove that a container/VM exists. There is no hosted shell, Git clone,
agent execution, terminal stream, diff, commit, or pull-request operation until CORTEX Engine is
implemented. The interface must report those as unavailable rather than simulate them.

## File request model

The browser requests `/v1/workspaces/:workspaceId/files/:path`. Each path segment is encoded by
the client; Cloud Control decodes and canonicalizes it exactly once before a database lookup.
Control characters, backslashes, traversal, and paths exceeding 4,096 characters are rejected.
Writes supply `expectedVersion`; a `409` means the caller must reload before retrying.
