"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Gauge,
  Globe,
  Layers,
  Link2,
  Loader2,
  MapPin,
  Monitor,
  RefreshCw,
  Smartphone,
  Sparkles,
  ScanEye,
} from "lucide-react";
import type {
  PublicSiteAuditLeadSnapshot,
  SiteAuditResult,
} from "@/lib/types/site-audit";
import { buildAuditDashboard } from "@/lib/utils/build-audit-dashboard";
import { AiCrawlSummary, SiteAuditDashboard } from "./SiteAuditDashboard";
import { AuditDeviceToggle, type AuditDevice } from "./AuditDeviceToggle";

interface SiteAuditReportViewProps {
  lead: PublicSiteAuditLeadSnapshot;
  result: SiteAuditResult | null;
  strategy?: AuditDevice;
  onStrategyChange?: (device: AuditDevice) => void;
  deviceAvailable?: Partial<Record<AuditDevice, boolean>>;
  scanningStrategy?: AuditDevice | null;
  auditing?: boolean;
  readOnly?: boolean;
  onRunAudit?: () => void;
  auditError?: string | null;
  shareUrl?: string;
  canAudit?: boolean;
  headlessRender?: boolean;
  onHeadlessRenderChange?: (enabled: boolean) => void;
}

type ReportTab = "overview" | "technical" | "outreach";

const TABS: { id: ReportTab; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Gauge size={15} /> },
  { id: "technical", label: "Technical details", icon: <Layers size={15} /> },
  { id: "outreach", label: "Outreach", icon: <FileText size={15} /> },
];

export function SiteAuditReportView({
  lead,
  result,
  strategy = "mobile",
  onStrategyChange,
  deviceAvailable = {},
  scanningStrategy = null,
  auditing = false,
  readOnly = false,
  onRunAudit,
  auditError,
  shareUrl,
  canAudit = true,
  headlessRender = false,
  onHeadlessRenderChange,
}: SiteAuditReportViewProps) {
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");

  const handleCopyPitch = async () => {
    if (!result?.insights.pitch) return;
    try {
      await navigator.clipboard.writeText(result.insights.pitch);
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const website =
    lead.website && lead.website !== "N/A" ? lead.website : null;
  const scannedLabel = result
    ? new Date(result.scannedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const dashboard =
    result &&
    (result.dashboard ??
      buildAuditDashboard({
        scores: result.scores,
        insights: result.insights,
        htmlMeta: result.htmlMeta,
        technicalSeo: result.technicalSeo ?? null,
      }));

  const activeDevice: AuditDevice = result?.strategy ?? strategy;
  const showDeviceToggle = !readOnly || Boolean(onStrategyChange);
  const otherDevice: AuditDevice = activeDevice === "mobile" ? "desktop" : "mobile";
  const needsDeviceScan =
    !result && !auditing && canAudit && !readOnly;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f4f6fa]">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-slate-200/80 shadow-sm">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" aria-hidden />

        <div className="px-5 pt-4 pb-4 pr-14">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-violet-600">
                {readOnly ? "Shared audit report" : "Website audit"}
              </p>
              <h1 className="text-xl font-bold text-slate-900 truncate mt-0.5">
                {lead.name}
              </h1>
              {website ? (
                <a
                  href={website.startsWith("http") ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1.5 mt-1 truncate max-w-full"
                >
                  <Globe size={14} className="shrink-0" />
                  <span className="truncate">{website}</span>
                  <ExternalLink size={12} className="shrink-0" />
                </a>
              ) : (
                <p className="text-sm text-red-500 mt-1">No website on file</p>
              )}
              {result && scannedLabel && !readOnly && (
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                  {activeDevice === "mobile" ? (
                    <Smartphone size={12} />
                  ) : (
                    <Monitor size={12} />
                  )}
                  {activeDevice === "mobile" ? "Mobile" : "Desktop"} Lighthouse · {scannedLabel}
                </p>
              )}
              {readOnly && result && (
                <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full w-fit">
                  {activeDevice === "mobile" ? (
                    <Smartphone size={12} />
                  ) : (
                    <Monitor size={12} />
                  )}
                  {activeDevice === "mobile" ? "Mobile" : "Desktop"} · {scannedLabel}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 shrink-0">
              {(showDeviceToggle || needsDeviceScan) && onStrategyChange && (
                <AuditDeviceToggle
                  value={strategy}
                  onChange={onStrategyChange}
                  disabled={readOnly || (auditing && scanningStrategy !== strategy)}
                  scanning={scanningStrategy}
                  available={deviceAvailable}
                />
              )}

              {!readOnly && onHeadlessRenderChange && (
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer max-w-[220px]">
                  <input
                    type="checkbox"
                    checked={headlessRender}
                    onChange={(e) => onHeadlessRenderChange(e.target.checked)}
                    disabled={auditing}
                    className="mt-0.5 accent-violet-600"
                  />
                  <span className="min-w-0">
                    <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1">
                      <ScanEye size={13} className="text-violet-600" />
                      Headless render
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Slower (+30–60s). Runs real Chromium for CSR accuracy.
                    </span>
                  </span>
                </label>
              )}

              {!readOnly && (
                <button
                  onClick={onRunAudit}
                  disabled={auditing || !canAudit}
                  className="shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition shadow-md shadow-violet-500/20 h-[52px]"
                >
                  {auditing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : result ? (
                    <RefreshCw size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {auditing
                    ? `Scanning ${strategy === "mobile" ? "mobile" : "desktop"}…`
                    : result
                      ? "Re-scan"
                      : "Run audit"}
                </button>
              )}
            </div>
          </div>

          {readOnly && result && !deviceAvailable[otherDevice] && (
            <p className="mt-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              This shared report only includes the{" "}
              <strong>{activeDevice}</strong> audit. Run a new scan from the app to compare
              mobile and desktop.
            </p>
          )}

          {deviceAvailable.mobile && deviceAvailable.desktop && !readOnly && (
            <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Mobile and desktop audits are saved — switch devices instantly to compare scores.
            </p>
          )}

          {auditing && !result && (
            <p className="mt-3 text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin shrink-0" />
              Fetching {scanningStrategy ?? strategy} PageSpeed scores…
            </p>
          )}

          {auditError && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
              {auditError}
            </p>
          )}

          {shareUrl && result && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Link2 size={15} className="text-emerald-700 shrink-0" />
                <span className="text-sm text-emerald-900 truncate">{shareUrl}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg inline-flex items-center justify-center gap-1.5"
              >
                <Copy size={14} />
                {copiedLink ? "Copied!" : "Copy link"}
              </button>
            </div>
          )}
        </div>

        {result && (
          <nav className="px-5 flex gap-1 border-t border-slate-100 bg-slate-50/50">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                  activeTab === tab.id
                    ? "border-violet-600 text-violet-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {!result && !auditing && !readOnly && (
          <div className="p-5">
            <EmptyState
              canAudit={canAudit}
              onRunAudit={onRunAudit}
              auditing={auditing}
              strategy={strategy}
            />
          </div>
        )}

        {auditing && !result && (
          <LoadingState strategy={scanningStrategy ?? strategy} headless={headlessRender} />
        )}

        {result && dashboard && (
          <div className="p-4 sm:p-5 space-y-4">
            {activeTab === "overview" && (
              <>
                {result.htmlAnalysisWarning && <WarningBanner message={result.htmlAnalysisWarning} />}
                <AiCrawlSummary dashboard={dashboard} />
                <SiteAuditDashboard
                  result={result}
                  dashboard={dashboard}
                  deviceLabel={activeDevice === "mobile" ? "Mobile" : "Desktop"}
                />
              </>
            )}

            {activeTab === "technical" && (
              <>
                {result.htmlAnalysisWarning && <WarningBanner message={result.htmlAnalysisWarning} />}
                {result.htmlFetchedUrl && result.htmlFetchedUrl !== result.url && (
                  <p className="text-sm text-slate-500 bg-white rounded-xl px-4 py-2 border border-slate-200">
                    HTML analyzed from{" "}
                    <a
                      href={result.htmlFetchedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {result.htmlFetchedUrl}
                    </a>
                  </p>
                )}

                <Section title="Google local search" icon={<MapPin size={16} />}>
                  {result.localRank ? (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-4">
                      <div>
                        <p className="text-sm text-blue-800 font-medium">Maps rank at business location</p>
                        <p className="text-sm text-slate-600 mt-1">
                          Keyword: <strong>{result.localRank.keyword}</strong>
                        </p>
                      </div>
                      <p className="text-4xl font-black text-blue-700">
                        #{result.localRank.rankLabel}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Local Maps rank not available. Add a search category to check rank.
                    </p>
                  )}
                </Section>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Section title="Core Web Vitals" icon={<Gauge size={16} />}>
                    <div className="space-y-3">
                      {result.metrics.map((m) => (
                        <MetricRow key={m.id} label={m.label} value={m.value} score={m.score} />
                      ))}
                    </div>
                  </Section>

                  <Section title="SEO & HTML" icon={<Globe size={16} />}>
                    <MetaRow label="Page title" value={result.htmlMeta.title} />
                    <MetaRow label="Meta description" value={result.htmlMeta.description} />
                    <MetaRow
                      label="H1 headings"
                      value={result.htmlMeta.h1.length > 0 ? result.htmlMeta.h1.join(" · ") : null}
                    />
                    <div className="grid grid-cols-2 gap-2 my-3">
                      <StatChip label="Word count" value={String(result.htmlMeta.wordCount)} />
                      <StatChip label="H2 count" value={String(result.htmlMeta.h2Count)} />
                      <StatChip label="Images" value={String(result.htmlMeta.imageCount)} />
                      <StatChip label="Links" value={String(result.htmlMeta.linkCount)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Tag ok={result.htmlMeta.hasViewport} label="Viewport" />
                      <Tag ok={result.htmlMeta.hasCanonical} label="Canonical" />
                      <Tag ok={result.htmlMeta.hasStructuredData} label="Schema" />
                      <Tag ok={result.htmlMeta.hasOgTags} label="Open Graph" />
                    </div>
                  </Section>
                </div>

                <Section title="Keywords on page">
                  <KeywordGroup label="From title" words={result.keywords.fromTitle} />
                  <KeywordGroup label="From description" words={result.keywords.fromDescription} />
                  <KeywordGroup label="From H1" words={result.keywords.fromH1} />
                  <KeywordGroup label="From body" words={result.keywords.fromBody} />
                </Section>

                {result.technicalSeo && (
                  <>
                    <Section title="Technical SEO">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <StatChip label="HTTPS" value={result.technicalSeo.ssl.secure ? "Secure" : "Not secure"} />
                        <StatChip label="robots.txt" value={result.technicalSeo.robotsTxt.found ? "Found" : "Missing"} />
                        <StatChip
                          label="Sitemap"
                          value={result.technicalSeo.sitemap.found ? `${result.technicalSeo.sitemap.urlCount} URLs` : "Missing"}
                        />
                        <StatChip label="llms.txt" value={result.technicalSeo.llmsTxt?.found ? "Found" : "Missing"} />
                      </div>
                      <MetaRow label="Rendering" value={result.technicalSeo.rendering.summary} />

                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            Rendering mode:{" "}
                            <span className="text-violet-700 uppercase">{result.technicalSeo.rendering.mode}</span>
                          </p>
                          <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
                            Confidence: {result.technicalSeo.rendering.confidence ?? "—"}%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                          <StatChip label="Browser words" value={String(result.technicalSeo.rendering.chromeWordCount)} />
                          <StatChip
                            label="Googlebot parity"
                            value={`${result.technicalSeo.rendering.botContentRatio}%`}
                          />
                          <StatChip
                            label="AI parity"
                            value={`${result.technicalSeo.rendering.aiContentRatio}%`}
                          />
                          <StatChip label="Scripts" value={String(result.technicalSeo.rendering.scriptCount)} />
                        </div>

                        {result.technicalSeo.rendering.signals?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-slate-600 mb-2">Signals</p>
                            <div className="space-y-1.5">
                              {result.technicalSeo.rendering.signals.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-700">{s.label}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{s.value}</p>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                      s.impact === "positive"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : s.impact === "negative"
                                          ? "bg-red-50 text-red-700"
                                          : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {s.impact}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.technicalSeo.rendering.headless?.enabled && (
                          <div
                            className={`mt-3 rounded-lg border px-3 py-3 ${
                              result.technicalSeo.rendering.headless.success
                                ? "border-violet-200 bg-violet-50/60"
                                : "border-amber-200 bg-amber-50/60"
                            }`}
                          >
                            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <ScanEye size={14} className="text-violet-600" />
                              Headless render check
                              {result.technicalSeo.rendering.headless.success && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white text-violet-700 border border-violet-200">
                                  {result.technicalSeo.rendering.headless.verdict.replace("_", " ")}
                                </span>
                              )}
                            </p>

                            {result.technicalSeo.rendering.headless.success ? (
                              <>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                  <StatChip
                                    label="Raw HTML words"
                                    value={String(result.technicalSeo.rendering.headless.rawWordCount)}
                                  />
                                  <StatChip
                                    label="Rendered words"
                                    value={String(result.technicalSeo.rendering.headless.renderedWordCount)}
                                  />
                                  <StatChip
                                    label="JS gain"
                                    value={`${result.technicalSeo.rendering.headless.contentGainPercent}%`}
                                  />
                                  <StatChip
                                    label="Render time"
                                    value={`${Math.round(result.technicalSeo.rendering.headless.renderTimeMs / 1000)}s`}
                                  />
                                </div>
                                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                                  {result.technicalSeo.rendering.headless.summary}
                                </p>
                                {result.technicalSeo.rendering.headless.renderedH1.length > 0 && (
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    Rendered H1:{" "}
                                    {result.technicalSeo.rendering.headless.renderedH1.join(" · ")}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-amber-800 mt-1">
                                {result.technicalSeo.rendering.headless.error ??
                                  "Headless check failed. Ensure Chromium is installed: npx playwright install chromium"}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </Section>

                    {result.technicalSeo.crawledPages.length > 0 && (
                      <Section
                        title="Crawled pages"
                        subtitle={`${result.technicalSeo.crawlBreakdown?.total ?? result.technicalSeo.crawledPages.length} pages`}
                      >
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50">
                              <tr className="text-slate-500">
                                <th className="py-2.5 pl-4 pr-2 font-medium">Page</th>
                                <th className="py-2.5 px-2 font-medium">Status</th>
                                <th className="py-2.5 px-2 font-medium">Words</th>
                                <th className="py-2.5 pr-4 pl-2 font-medium">Issue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.technicalSeo.crawledPages.map((page) => (
                                <tr key={page.url} className="border-t border-slate-50">
                                  <td className="py-2.5 pl-4 pr-2 max-w-[220px] truncate" title={page.url}>
                                    {page.title || page.url}
                                  </td>
                                  <td className="py-2.5 px-2 tabular-nums">{page.status || "—"}</td>
                                  <td className="py-2.5 px-2 tabular-nums">{page.wordCount}</td>
                                  <td className="py-2.5 pr-4 pl-2 text-amber-700">{page.issue || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Section>
                    )}
                  </>
                )}

                <Section title="Detailed findings" subtitle="Lighthouse & HTML issues">
                  {result.findings.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                      {result.findings.map((f) => (
                        <div
                          key={f.id}
                          className={`text-sm rounded-xl px-4 py-3 border ${
                            f.severity === "critical"
                              ? "bg-red-50 border-red-100 text-red-900"
                              : "bg-amber-50 border-amber-100 text-amber-900"
                          }`}
                        >
                          <p className="font-semibold">{f.title}</p>
                          {f.description && (
                            <p className="text-xs mt-1 opacity-90 leading-relaxed">{f.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No detailed findings.</p>
                  )}
                </Section>
              </>
            )}

            {activeTab === "outreach" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Section title="Issues found" icon={<AlertTriangle size={16} />}>
                    {result.insights.issues.length > 0 ? (
                      <InsightList items={result.insights.issues} variant="issue" />
                    ) : (
                      <p className="text-sm text-slate-500">No major issues flagged.</p>
                    )}
                  </Section>
                  <Section title="Recommendations" icon={<CheckCircle2 size={16} />}>
                    {result.insights.recommendations.length > 0 ? (
                      <InsightList items={result.insights.recommendations} variant="win" />
                    ) : (
                      <p className="text-sm text-slate-500">No recommendations at this time.</p>
                    )}
                  </Section>
                </div>

                <Section title="Ready-to-send pitch" icon={<FileText size={16} />}>
                  <pre className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4 whitespace-pre-wrap border border-slate-100 max-h-64 overflow-y-auto scrollbar-thin leading-relaxed">
                    {result.insights.pitch}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyPitch}
                    className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-6 py-3 rounded-xl transition"
                  >
                    <Copy size={15} />
                    {copiedPitch ? "Copied!" : "Copy pitch message"}
                  </button>
                </Section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState({
  strategy,
  headless = false,
}: {
  strategy: AuditDevice;
  headless?: boolean;
}) {
  const steps = headless
    ? [
        `Running ${strategy} PageSpeed…`,
        "Crawling pages & checking AI bots…",
        "Launching headless Chromium render…",
        "Comparing raw HTML vs rendered DOM…",
        "Building your report…",
      ]
    : [
        `Running ${strategy} PageSpeed…`,
        "Analyzing Core Web Vitals…",
        "Crawling pages & checking AI bots…",
        "Building your report…",
      ];
  const [step] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-violet-100" />
        <Loader2
          size={40}
          className="absolute inset-0 m-auto animate-spin text-violet-600"
        />
      </div>
      <div className="text-center max-w-md">
        <p className="text-lg font-semibold text-slate-800">
          Scanning {strategy === "mobile" ? "mobile" : "desktop"} experience…
        </p>
        <p className="text-sm text-slate-500 mt-2">{steps[step]}</p>
        <p className="text-xs text-slate-400 mt-3">
          {headless
            ? "Usually takes 45–90 seconds with headless render enabled"
            : "Usually takes 20–40 seconds per device"}
        </p>
      </div>
      <div className="flex gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i <= step ? "w-8 bg-violet-500" : "w-4 bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Partial audit — HTML crawl failed</p>
      <p className="text-xs mt-1 leading-relaxed">{message}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-start gap-2 mb-4">
        {icon && <span className="text-violet-500 mt-0.5">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricRow({
  label,
  value,
  score,
}: {
  label: string;
  value: string;
  score?: number | null;
}) {
  const color =
    score == null ? "#94a3b8" : score >= 90 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const width = score ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-semibold text-slate-900 tabular-nums">{value}</span>
      </div>
      {score != null && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${width}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
      <p className="text-[10px] text-slate-400 uppercase font-medium">{label}</p>
      <p className="text-sm font-semibold text-slate-800 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function Tag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
      }`}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function KeywordGroup({ label, words }: { label: string; words: string[] }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      {words.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {words.map((w) => (
            <span
              key={`${label}-${w}`}
              className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg font-medium"
            >
              {w}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">None detected</p>
      )}
    </div>
  );
}

function InsightList({
  items,
  variant,
}: {
  items: string[];
  variant: "issue" | "win";
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item}
          className={`flex items-start gap-2.5 text-sm leading-relaxed ${
            variant === "issue" ? "text-red-800" : "text-emerald-800"
          }`}
        >
          {variant === "issue" ? (
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          )}
          {item}
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  canAudit,
  onRunAudit,
  auditing,
  strategy,
}: {
  canAudit: boolean;
  onRunAudit?: () => void;
  auditing?: boolean;
  strategy: AuditDevice;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center bg-white rounded-2xl border border-dashed border-slate-200">
      <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
        {strategy === "mobile" ? (
          <Smartphone size={32} className="text-violet-400" />
        ) : (
          <Monitor size={32} className="text-violet-400" />
        )}
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-800">
          Ready to audit — {strategy === "mobile" ? "mobile" : "desktop"}
        </p>
        <p className="text-sm text-slate-500 max-w-md mt-2 px-4">
          {canAudit
            ? "Pick Mobile or Desktop above, then run the audit. Switch anytime — each device is scanned separately and cached for instant comparison."
            : "Add a website URL to this lead first."}
        </p>
      </div>
      {canAudit && onRunAudit && (
        <button
          onClick={onRunAudit}
          disabled={auditing}
          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-md shadow-violet-500/20"
        >
          <Sparkles size={16} />
          Run website audit
        </button>
      )}
    </div>
  );
}
