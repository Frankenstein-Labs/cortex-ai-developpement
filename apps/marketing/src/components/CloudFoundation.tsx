// FILE: CloudFoundation.tsx
// Purpose: Evidence-based landing section for the CORTEX web platform.
// Layer: Marketing UI section

import { ArrowRight, Files, LockKeyhole, ServerCog, Sparkles } from "lucide-react";
import Link from "next/link";
import { resolveCloudAppUrl } from "@/lib/cloudAppUrl";

const cloudAppUrl = resolveCloudAppUrl();

const foundations = [
  {
    icon: LockKeyhole,
    title: "Organization-scoped by default",
    detail: "Opaque sessions, memberships, and PostgreSQL row-level security protect cloud resources.",
  },
  {
    icon: Files,
    title: "Persisted workspace files",
    detail: "Open and save cloud files with canonical paths, tenant checks, and version-conflict protection.",
  },
  {
    icon: ServerCog,
    title: "Execution kept outside the browser",
    detail: "A future isolated Runner owns terminals, Git, and agent execution—not a Vercel function.",
  },
] as const;

export function CloudFoundation() {
  return (
    <section
      id="cloud"
      className="relative scroll-mt-20 overflow-hidden border-t border-[var(--divide)] py-14 sm:py-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,var(--glow-a),transparent_68%)] opacity-70"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(25rem,1.15fr)] lg:items-center lg:gap-16">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              CORTEX Platform
            </p>
            <h2 className="mt-3 max-w-xl text-[1.8rem] font-medium leading-[1.08] tracking-[-0.04em] text-[var(--text-primary)] sm:text-[2.5rem]">
              The web workspace is becoming the control surface.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-[1.7] text-[var(--text-secondary)] sm:text-[16px]">
              CORTEX Cloud brings authenticated projects and versioned files to the web today,
              while preserving the proven local runtime. The execution plane is deliberately not
              presented as finished before isolation and lifecycle guarantees exist.
            </p>
            <Link
              href={`${cloudAppUrl}/signup`}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--btn-primary-bg)] px-5 py-2.5 text-[13px] font-medium text-[var(--btn-primary-fg)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-link)]"
            >
              Open CORTEX Cloud
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="animate-rise-in rounded-2xl border border-[var(--divide)] bg-[color-mix(in_oklab,var(--block-elevated)_72%,transparent)] p-3 sm:p-4">
            <div className="rounded-xl border border-[var(--divide)] bg-[var(--page-bg)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--divide)] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-[var(--mock-row)] text-[var(--text-primary)]">
                    <Sparkles className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">CORTEX Cloud</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">Control plane status</p>
                  </div>
                </div>
                <span className="rounded-full border border-[var(--divide)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  Foundation
                </span>
              </div>
              <ol className="mt-3 divide-y divide-[var(--divide)]">
                {foundations.map(({ icon: Icon, title, detail }, index) => (
                  <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 py-4" key={title}>
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--mock-row)] text-[var(--text-secondary)]">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[13px] font-medium text-[var(--text-primary)]">{title}</h3>
                        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">0{index + 1}</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 rounded-lg border border-dashed border-[var(--divide)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                Runner, terminal, cloud Git, and hosted agents remain unavailable until their
                isolated execution boundary is implemented.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
