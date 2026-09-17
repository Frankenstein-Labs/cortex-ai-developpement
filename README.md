<div align="center">
  <img src="./assets/prod/logo.svg" width="112" alt="CORTEX logo">
  <h1>CORTEX</h1>
  <p><strong>AI development workspaces, built around CORTEX.</strong><br>
  Projects, agent sessions, execution surfaces, review tools, and an emerging cloud control plane in one product.</p>
  <p>
    <a href="https://github.com/Frankenstein-Labs/cortex-ai-developpement/releases">Download</a>
    &nbsp;·&nbsp;
    <a href="./apps/marketing/README.md">Website source</a>
    &nbsp;·&nbsp;
    <a href="./docs/README.md">Documentation</a>
    &nbsp;·&nbsp;
    <a href="./docs/external-mcp.md">MCP integration</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/Frankenstein-Labs/cortex-ai-developpement/issues/new/choose">Report an issue</a>
  </p>
</div>

<details>
  <summary><strong>Table of contents</strong></summary>

| Workspace layer      | Responsibility                                                |
| -------------------- | ------------------------------------------------------------- |
| **Project**          | Repository context, settings, and related work.               |
| **Thread**           | Task-specific conversation, state, files, and history.        |
| **Provider session** | The authenticated coding-agent runtime executing the task.    |
| **Workspace tools**  | Changes, terminal, browser, files, editor, previews, and Git. |

> [!NOTE]
> CORTEX is early-stage software. APIs and interface details remain under active development.

## Capabilities

### 1. Projects, threads, and context

Organize work around projects and threads. Projects define the workspace; threads preserve the task-specific conversation, state, files, and history.

- Project-aware navigation and conversations
- Provider and model selection per task
- Thread history, status, recaps, notes, and side chats
- Search and quick access across active work

### 2. Integrated workspace tools

The tools surrounding an agent session remain available from the same task surface, keeping execution and review connected.

| Surface            | Purpose                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Changes**        | Inspect diffs, changed files, and review state.                                                   |
| **Terminal**       | Run commands in the project environment.                                                          |
| **Browser**        | Keep local previews next to the thread and let agents use semantic or page-declared WebMCP tools. |
| **Files / Editor** | Browse, inspect, and edit project files in context.                                               |
| **Git**            | Work with branches, commits, pushes, and pull requests.                                           |

### 3. Split views and previews

Keep an active conversation alongside the surface it is changing. Split views, browser previews, and device previews make the result part of the working context.

<p align="center">
  <img src="./assets/prod/readme-split-view-dark.png" width="900" alt="CORTEX split view with an agent thread and iOS simulator preview">
</p>

### 4. Provider-native integrations

CORTEX connects to coding-agent runtimes that are installed and authenticated locally. The current development build includes the following integrations:

| Runtime         | Local integration                           |
| --------------- | ------------------------------------------- |
| **Codex**       | Codex CLI / app-server                      |
| **Claude**      | Claude Code                                 |
| **Cursor**      | Cursor agent runtime                        |
| **Antigravity** | Antigravity CLI                             |
| **Grok**        | Grok Build                                  |
| **Droid**       | Factory Droid                               |
| **OpenCode**    | OpenCode and its configured model providers |
| **Pi**          | Pi and its configured model providers       |
| **Devin**       | Devin CLI                                   |

### 5. Isolated parallel work

Managed worktrees provide a boundary for parallel changes. Handoffs preserve project context when a task needs to continue with another provider or toolchain.

- Run work in a local checkout or an isolated managed worktree
- Keep parallel threads from modifying the same checkout unintentionally
- Hand off a task without losing its project context
- Review the resulting diff before it leaves the workspace

### 6. Automations and external MCP

Automations support recurring agent runs and keep their outcomes attached to projects and threads. External MCP integrations provide scoped, user-approved access for other local clients.

See [External MCP integrations](./docs/external-mcp.md) for setup, pairing, project access, and permission boundaries.

### 7. CORTEX Cloud foundation

The web application includes authenticated CORTEX Cloud routes backed by the separately
deployable `apps/cloud-control` service. The control plane uses opaque HttpOnly sessions,
organization-scoped PostgreSQL transactions, forced row-level security, projects, workspace
metadata, and versioned cloud-file persistence. It intentionally does **not** simulate a hosted
agent, terminal, Git, or runtime while an execution plane is unavailable.

See [`apps/cloud-control/README.md`](./apps/cloud-control/README.md) for configuration and
deployment requirements, and the [CORTEX platform implementation report](./CORTEX_PLATFORM_IMPLEMENTATION_REPORT.md) for the current capability boundary.

### 8. Appearance and workspace preferences

Configure the shell to match the way you work with light and dark themes, typography controls, density preferences, and workspace settings.

<p align="center">
  <img src="./assets/prod/readme-appearance-dark.png" width="900" alt="CORTEX appearance settings with theme, typography, and density controls">
</p>

### Additional capabilities

| Workflow          | Included surfaces                                               |
| ----------------- | --------------------------------------------------------------- |
| **Workspace**     | Local projects, chats, history, and multiple provider runtimes. |
| **Execution**     | Terminals, browser previews, files, and editor.                 |
| **Delivery**      | Diffs, Git actions, managed worktrees, and pull requests.       |
| **Orchestration** | Provider handoffs, automations, and scoped external MCP.        |
| **Development**   | Desktop shell plus focused server and web modes.                |

## Installation

### Desktop application

Download the latest build from [CORTEX GitHub Releases](https://github.com/Frankenstein-Labs/cortex-ai-developpement/releases). The public website source lives in [`apps/marketing`](./apps/marketing/README.md).

Current native release targets are Windows x64, macOS Intel, macOS Apple Silicon, and Linux x64.

### Provider setup

CORTEX uses the provider installations and subscriptions already configured on the local machine. Install and authenticate the runtime you intend to use before starting a session. For Codex sessions, follow the [Codex CLI setup](https://github.com/openai/codex).

### Run from source

The development checkout uses [Bun 1.4.2](https://bun.sh/) and [Node.js 24.13.1](https://nodejs.org/).

```console
git clone https://github.com/Frankenstein-Labs/cortex-ai-developpement.git
cd cortex-ai-developpement
bun install
bun run dev
```

`bun run typecheck` checks all seven workspaces with TypeScript 7 and the native
Effect checker. CI and each workspace's `typecheck` script use the same compiler.
`bun run typecheck:native` remains an alias for the default check.

The native Effect checker does not enforce every legacy rule: in particular,
`importFromBarrel` errors are currently missed. `bun run typecheck:legacy` keeps
the TypeScript 5 check available for explicit comparisons; it is not run by CI.
The existing compiler also remains installed for build and declaration tools
that require its JavaScript API. Native and legacy checks use separate caches.

Use these named scripts rather than a bare `tsc`, whose version depends on the
current directory. Normal installation patches the native compiler for Effect;
the root `typecheck` command also ensures that patch is applied before checking.

## Contributing

Bug fixes, reliability improvements, performance work, documentation, and maintenance changes are welcome.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. For a reproducible problem, [open an issue](https://github.com/Frankenstein-Labs/cortex-ai-developpement/issues/new/choose) with the CORTEX version, operating system, runtime, and relevant logs.

## License

CORTEX is licensed under the [MIT License](./LICENSE).
