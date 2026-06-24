"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gauge,
  Globe,
  Link2,
  Loader2,
  Search,
  Shield,
  Zap,
} from "lucide-react";
import type {
  PublicSiteAuditLeadSnapshot,
  SiteAuditResult,
} from "@/lib/types/site-audit";

interface SiteAuditReportViewProps {
  lead: PublicSiteAuditLeadSnapshot;
  result: SiteAuditResult | null;
  auditing?: boolean;
  readOnly?: boolean;
  onRunAudit?: () => void;
  auditError?: string | null;
  shareUrl?: string;
  canAudit?: boolean;
}

export function SiteAuditReportView({
  lead,
  result,
  auditing = false,
  readOnly = false,
  onRunAudit,
  auditError,
  shareUrl,
  canAudit = true,
}: SiteAuditReportViewProps) {
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-50">
      <header className="shrink-0 bg-white border-b border-neutral-200 px-5 py-3">
        <div className="flex items-start justify-between gap-3 pr-10">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
              {readOnly ? "Shared Website Audit" : "Website Audit"}
            </span>
            <h1 className="text-lg font-bold text-neutral-900 truncate mt-1">
              {lead.name}
            </h1>
            {website ? (
              <a
                href={website.startsWith("http") ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate"
              >
                <Globe size={12} />
                {website}
                <ExternalLink size={10} />
              </a>
            ) : (
              <p className="text-xs text-red-500">No website on file</p>
            )}
          </div>
          {result && (
            <div
              className="shrink-0 text-center px-4 py-2 rounded-xl border"
              style={{
                borderColor: result.insights.gradeColor,
                backgroundColor: `${result.insights.gradeColor}15`,
              }}
            >
              <p className="text-2xl font-black" style={{ color: result.insights.gradeColor }}>
                {result.insights.grade}
              </p>
              <p className="text-[10px] text-neutral-500">{result.insights.overallScore}/100</p>
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={onRunAudit}
              disabled={auditing || !canAudit}
              className="flex-1 sm:flex-none bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              {auditing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Gauge size={16} />
              )}
              {auditing ? "Auditing…" : "Run Website Audit"}
            </button>
            {!canAudit && (
              <p className="text-xs text-red-500 self-center">
                This lead has no website URL
              </p>
            )}
          </div>
        )}

        {auditError && (
          <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2">
            {auditError}
          </p>
        )}

        {shareUrl && result && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link2 size={14} className="text-green-700 shrink-0" />
              <span className="text-xs text-green-800 truncate font-medium">
                {shareUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 text-xs font-semibold bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5"
            >
              <Copy size={12} />
              {copiedLink ? "Copied!" : "Copy client link"}
            </button>
          </div>
        )}
      </header>

      {result && (
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-px bg-neutral-200 border-b">
          <ScoreCell label="Performance" value={result.scores.performance} icon={<Zap size={14} />} />
          <ScoreCell label="Accessibility" value={result.scores.accessibility} icon={<Shield size={14} />} />
          <ScoreCell label="SEO" value={result.scores.seo} icon={<Search size={14} />} />
          <ScoreCell label="Best Practices" value={result.scores.bestPractices} icon={<CheckCircle2 size={14} />} />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {auditing && !result && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500">
            <Loader2 size={36} className="animate-spin text-violet-600" />
            <p className="text-sm font-semibold">Running Lighthouse audit…</p>
            <p className="text-xs text-neutral-400">Speed, SEO, accessibility — 20–40 seconds</p>
          </div>
        )}

        {!result && !auditing && !readOnly && (
          <EmptyState canAudit={canAudit} />
        )}

        {result && (
          <>
            {result.localRank && (
              <Panel title="Google search position">
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Maps rank at business location</p>
                    <p className="text-sm text-neutral-600 mt-0.5">
                      Keyword: <strong>{result.localRank.keyword}</strong>
                    </p>
                  </div>
                  <p className="text-3xl font-black text-blue-700">
                    #{result.localRank.rankLabel}
                  </p>
                </div>
              </Panel>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Core Web Vitals & speed">
                <div className="space-y-2">
                  {result.metrics.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">{m.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900">{m.value}</span>
                        {m.score != null && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              m.score >= 90
                                ? "bg-green-100 text-green-700"
                                : m.score >= 50
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {m.score}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="SEO & HTML analysis">
                <MetaRow label="Page title" value={result.htmlMeta.title} />
                <MetaRow label="Meta description" value={result.htmlMeta.description} />
                <MetaRow label="H1 headings" value={result.htmlMeta.h1.join(" · ") || "—"} />
                <MetaRow label="Word count" value={String(result.htmlMeta.wordCount)} />
                <MetaRow label="SSR / rendering" value={result.htmlMeta.ssrNote} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Tag ok={result.htmlMeta.hasViewport} label="Viewport" />
                  <Tag ok={result.htmlMeta.hasCanonical} label="Canonical" />
                  <Tag ok={result.htmlMeta.hasStructuredData} label="Schema" />
                  <Tag ok={result.htmlMeta.hasOgTags} label="Open Graph" />
                </div>
              </Panel>
            </div>

            <Panel title="Keywords detected on page">
              <KeywordGroup label="From title" words={result.keywords.fromTitle} />
              <KeywordGroup label="From H1" words={result.keywords.fromH1} />
              <KeywordGroup label="From description" words={result.keywords.fromDescription} />
              <KeywordGroup label="Body content" words={result.keywords.fromBody} />
              {result.keywords.missingOpportunities.length > 0 && (
                <p className="text-xs text-amber-700 mt-2 bg-amber-50 rounded-lg px-3 py-2">
                  Missing: {result.keywords.missingOpportunities.join(", ")}
                </p>
              )}
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InsightPanel
                title="Issues found"
                items={result.insights.issues}
                variant="issue"
              />
              <InsightPanel
                title="Recommendations"
                items={result.insights.recommendations}
                variant="win"
              />
            </div>

            {result.findings.length > 0 && (
              <Panel title="Detailed audit findings">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {result.findings.map((f) => (
                    <div
                      key={f.id}
                      className={`text-xs rounded-lg px-3 py-2 border ${
                        f.severity === "critical"
                          ? "bg-red-50 border-red-100 text-red-800"
                          : "bg-amber-50 border-amber-100 text-amber-900"
                      }`}
                    >
                      <p className="font-semibold">{f.title}</p>
                      {f.description && (
                        <p className="text-[10px] mt-0.5 opacity-80 line-clamp-2">
                          {f.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel title="Outreach pitch">
              <pre className="text-xs text-neutral-600 bg-neutral-50 rounded-lg p-3 whitespace-pre-wrap border border-neutral-100 max-h-40 overflow-y-auto">
                {result.insights.pitch}
              </pre>
              <button
                type="button"
                onClick={handleCopyPitch}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2.5 rounded-xl"
              >
                <Copy size={13} />
                {copiedPitch ? "Copied!" : "Copy pitch message"}
              </button>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

function ScoreCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  const color =
    value >= 90 ? "#22c55e" : value >= 50 ? "#eab308" : "#dc2626";
  return (
    <div className="bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-black mt-0.5" style={{ color }}>
        {value}
      </p>
      <div className="mt-1.5 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-sm mb-2">
      <p className="text-[10px] text-neutral-400 uppercase">{label}</p>
      <p className="text-neutral-800 truncate">{value || "—"}</p>
    </div>
  );
}

function Tag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function KeywordGroup({ label, words }: { label: string; words: string[] }) {
  if (words.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="text-[10px] text-neutral-400 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {words.map((w) => (
          <span
            key={`${label}-${w}`}
            className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-md font-medium"
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

function InsightPanel({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "issue" | "win";
}) {
  return (
    <Panel title={title}>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`flex items-start gap-1.5 text-xs leading-snug ${
              variant === "issue" ? "text-red-700" : "text-green-700"
            }`}
          >
            {variant === "issue" ? (
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function EmptyState({ canAudit }: { canAudit: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <Gauge size={40} className="text-violet-300" />
      <p className="font-semibold text-neutral-700">Website audit ready</p>
      <p className="text-sm text-neutral-400 max-w-md">
        {canAudit
          ? "Run a full audit: performance, speed index, accessibility, SEO, keywords, and Google rank."
          : "Add a website URL to this lead to run an audit."}
      </p>
    </div>
  );
}
