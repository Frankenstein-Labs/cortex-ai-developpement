// FILE: data/product.ts
// Purpose: Canonical public product language shared by marketing, metadata,
//          structured data, FAQs, and AI-readable discovery surfaces.
// Layer: static content (server/client importable).
export const PRODUCT_NAME = "CORTEX Cloud";
export const PRODUCT_CATEGORY =
  "AI-powered development workspace for projects, agents, code, Git, and execution.";
export const PRODUCT_HERO_TITLE = "Run every coding agent in one workspace";
export const PRODUCT_HERO_DESCRIPTION =
  "CORTEX Cloud is a developer-first workspace where projects, files, Git workflows, terminals, and agent-assisted development come together.";
export const PRODUCT_META_DESCRIPTION =
  "CORTEX Cloud is an AI-powered development workspace for projects, code, Git, terminals, files, and agent-assisted software delivery.";
export const PRODUCT_DESCRIPTION =
  "CORTEX Cloud brings projects, workspaces, files, Git, terminals, diffs, pull requests, and agent-assisted development into one developer-first environment. Existing local runtime capabilities remain available while the cloud control plane is being connected.";
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
