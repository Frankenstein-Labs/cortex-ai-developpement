// FILE: page.tsx
// Purpose: Public marketing homepage for CORTEX Cloud.
// Layer: App Router page (server component)

import { SiGithub, SiOpenai } from "react-icons/si";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import DownloadButton from "@/components/DownloadButton";
import InstallerCount from "@/components/InstallerCount";
import Features from "@/components/Features";
import Workflow from "@/components/Workflow";
import FAQ from "@/components/FAQ";
import AskAISection from "@/components/AskAISection";
import Testimonials from "@/components/Testimonials";
import ClosingCTA from "@/components/ClosingCTA";
import SiteFooter from "@/components/SiteFooter";
import PrivacySection from "@/components/PrivacySection";
import HomepageRail from "@/components/HomepageRail";
import { CloudFoundation } from "@/components/CloudFoundation";
import {
  AntigravityIcon,
  ClaudeIcon,
  OpencodeIcon,
  CursorIcon,
  DevinIcon,
  GrokIcon,
  PiIcon,
  DroidIcon,
} from "@/components/BrandIcons";
import { getInstallerCount } from "@/lib/installerCount";
import { PRODUCT_HERO_DESCRIPTION, PRODUCT_HERO_TITLE } from "@/data/product";
import { FAQ_JSONLD, GITHUB_REPO_URL, jsonLdScript } from "@/lib/seo";
import { resolveCloudAppUrl } from "@/lib/cloudAppUrl";

export const dynamic = "force-dynamic";

export default async function Home() {
  const installerCount = await getInstallerCount();
  const cloudAppUrl = resolveCloudAppUrl();

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--page-bg)] text-[var(--text-primary)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(FAQ_JSONLD) }}
      />
      <Navbar />

      <main>
        <section
          id="overview"
          aria-labelledby="homepage-title"
          className="hero-section scroll-mt-20 pt-6 pb-12 sm:pt-10 sm:pb-20"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-center gap-2 sm:mb-10">
              <div className="inline-flex size-[38px] -rotate-[6deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <ClaudeIcon className="size-[18px] text-[#D97757]" />
              </div>
              <div className="inline-flex size-[38px] rotate-[4deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <SiOpenai className="size-[18px] text-[var(--text-primary)]" aria-hidden="true" />
              </div>
              <div className="inline-flex size-[38px] rotate-[5deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <OpencodeIcon className="size-[18px] text-[var(--text-primary)]" />
              </div>
              <div className="inline-flex size-[38px] -rotate-[4deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <CursorIcon className="size-[18px] text-[var(--text-primary)]" />
              </div>
              <div className="inline-flex size-[38px] -rotate-[2deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <AntigravityIcon className="size-[18px]" />
              </div>
              <div className="inline-flex size-[38px] rotate-[2deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <GrokIcon className="size-[18px] text-[var(--text-primary)]" />
              </div>
              <div className="inline-flex size-[38px] rotate-[3deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <DevinIcon className="size-[18px] text-[var(--text-primary)]" />
              </div>
              <div className="inline-flex size-[38px] -rotate-[5deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <PiIcon className="size-[18px] text-[var(--text-primary)]" />
              </div>
              <div className="inline-flex size-[38px] rotate-[5deg] items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                <DroidIcon className="size-[18px] text-[var(--text-primary)]" />
              </div>
            </div>

            <h1
              id="homepage-title"
              className="text-[1.5rem] font-medium leading-[1.12] tracking-[-0.035em] text-[var(--text-primary)] sm:text-[2rem] sm:leading-[1.08]"
            >
              {PRODUCT_HERO_TITLE}
            </h1>
            {/* data-live-hero-color: rendered in the LIVE site's exact colors
                (Kartik: hero matches production pixel-for-pixel). Those mandated
                colors are under the 4.5:1 AA threshold on the page background, so
                the a11y suite excludes these two elements from color-contrast. */}
            <p
              data-live-hero-color="true"
              className="mt-5 text-[13px] leading-[1.6] text-[color-mix(in_oklab,var(--text-primary)_58%,transparent)] dark:text-[color-mix(in_oklab,var(--text-primary)_55%,transparent)] sm:text-[14px]"
            >
              {PRODUCT_HERO_DESCRIPTION}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3" data-home-actions>
              <Link
                href={`${cloudAppUrl}/signup`}
                className="inline-flex min-w-[10.5rem] items-center justify-center rounded-full bg-[var(--btn-primary-bg)] px-5 py-2.5 text-[13px] font-medium text-[var(--btn-primary-fg)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-link)]"
              >
                Open CORTEX Cloud
              </Link>
              <DownloadButton className="border border-[var(--divide)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--mock-row)]" />
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--divide)] px-5 py-2.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--mock-row)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-link)]"
              >
                <SiGithub className="size-4 shrink-0" aria-hidden="true" />
                Star on GitHub
              </a>
            </div>
            <p
              data-live-hero-color="true"
              className="mt-4 text-[12px] text-[color-mix(in_oklab,var(--text-primary)_42%,transparent)] dark:text-[color-mix(in_oklab,var(--text-primary)_38%,transparent)]"
            >
              <InstallerCount initialCount={installerCount} />
            </p>

            <div className="relative mt-10 sm:mt-14" data-hero-preview>
              <div className="relative overflow-hidden rounded-xl bg-[var(--block-elevated)] p-2 ring-1 ring-black/5 sm:rounded-2xl sm:p-3 dark:ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cortex-cloud-ui-light.png"
                  alt="CORTEX Cloud — AI-powered development workspace for projects, files, Git, terminals, and agent-assisted delivery"
                  className="block h-auto w-full rounded-lg dark:hidden sm:rounded-xl"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cortex-cloud-ui-dark.png"
                  alt="CORTEX Cloud — AI-powered development workspace for projects, files, Git, terminals, and agent-assisted delivery"
                  className="hidden h-auto w-full rounded-lg dark:block sm:rounded-xl"
                />
              </div>
            </div>
          </div>
        </section>

        <CloudFoundation />

        <div id="providers" className="scroll-mt-20">
          <Features />
        </div>
        <div id="workflow" className="scroll-mt-20">
          <Workflow />
        </div>
        <div id="privacy" className="scroll-mt-20">
          <PrivacySection />
        </div>

        <AskAISection />

        <FAQ />
        <Testimonials />
        <div id="download" className="scroll-mt-20">
          <ClosingCTA initialInstallerCount={installerCount} />
        </div>
      </main>

      <SiteFooter />
      <HomepageRail />
    </div>
  );
}
