// FILE: data/product.ts
// Purpose: Canonical public product language shared by marketing, metadata,
//          structured data, FAQs, and AI-readable discovery surfaces.
// Layer: static content (server/client importable).
export const PRODUCT_NAME = "CORTEX";
export const PRODUCT_CATEGORY =
  "A developer workspace for projects, agents, code, Git, and execution.";
export const PRODUCT_HERO_TITLE = "Direct the work. Keep the evidence.";
export const PRODUCT_HERO_DESCRIPTION =
  "CORTEX brings coding-agent work, project context, files, review, and delivery into one developer-first surface—on the web and in the local runtime where execution is already proven.";
export const PRODUCT_META_DESCRIPTION =
  "The local-first workspace and control plane for coding agents. CORTEX Cloud brings projects, code, Git, terminals, files, and reviewable delivery together.";
export const PRODUCT_DESCRIPTION =
  "CORTEX brings projects, workspaces, files, Git, terminals, diffs, pull requests, and agent-assisted development into one developer-first environment. The cloud control plane provides authenticated projects and files while the isolated execution plane is still being built.";
export const SUPPORTED_PROVIDERS = [
  "CORTEX AI",
  "Claude Code",
  "Codex",
  "OpenCode",
  "Cursor",
] as const;
export const PRODUCT_PILLARS = [
  {
    title: "Projects with a clear home",
    description:
      "Keep projects, workspaces, files, tasks, and delivery context organized around the work being shipped.",
  },
  {
    title: "CORTEX AI in the loop",
    description:
      "Use agent-assisted development alongside the code, terminal, Git, and review surfaces that make results inspectable.",
  },
  {
    title: "Reviewable changes",
    description:
      "Inspect commands, file changes, diffs, checks, commits, and pull requests before accepting a result.",
  },
  {
    title: "Tenant-aware foundations",
    description:
      "The cloud control plane is built around organizations, memberships, scoped resources, and database-enforced isolation.",
  },
] as const;
