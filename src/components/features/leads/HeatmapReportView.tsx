"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  Info,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Star,
  X,
} from "lucide-react";
import { HeatmapMapViewer } from "@/components/features/leads/HeatmapMapViewer";
import type {
  HeatmapCompetitor,
  HeatmapScanResult,
  PublicHeatmapLeadSnapshot,
} from "@/lib/types/heatmap";
import { getRankStyle, HEATMAP_LEGEND } from "@/lib/utils/heatmap-colors";
import { getHeatmapCoverageInfo } from "@/lib/utils/heatmap-coverage";
import { getLeadMapsUrl } from "@/lib/utils/google-maps";
import {
  downloadHeatmapCsv,
  downloadHeatmapPdf,
} from "@/lib/utils/export-heatmap";
import { mergeHeatmapOpportunities } from "@/lib/utils/heatmap-insights";

export interface HeatmapReportViewProps {
  lead: PublicHeatmapLeadSnapshot;
  result: HeatmapScanResult | null;
  scanning?: boolean;
  readOnly?: boolean;
  keyword?: string;
  onKeywordChange?: (value: string) => void;
  onScan?: () => void;
  scanError?: string | null;
  shareUrl?: string;
  onClose?: () => void;
}

export function HeatmapReportView({
  lead,
  result,
  scanning = false,
  readOnly = false,
  keyword = "",
  onKeywordChange,
  onScan,
  scanError,
  shareUrl,
  onClose,
}: HeatmapReportViewProps) {
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [mapInfoOpen, setMapInfoOpen] = useState(false);

  useEffect(() => {
    setMapInfoOpen(false);
  }, [result?.keyword, lead.placeId]);

  const gridCells = useMemo(() => {
    if (!result) return [];
    const size = result.gridSize;
    const matrix: ((typeof result.cells)[number] | null)[][] = Array.from(
      { length: size },
      () => Array.from({ length: size }, () => null)
    );
    for (const cell of result.cells) {
      matrix[cell.row]![cell.col] = cell;
    }
    return matrix;
  }, [result]);

  const centerCell = useMemo(
    () => result?.cells.find((cell) => cell.isCenter) ?? null,
    [result]
  );

  const rating = result?.business.rating ?? null;
  const reviewCount = result?.business.userRatingsTotal ?? null;
  const rankStyle = centerCell ? getRankStyle(centerCell.rank) : null;
  const coverageInfo = result ? getHeatmapCoverageInfo(result) : null;
  const howWeCanHelpItems = result
    ? mergeHeatmapOpportunities(result.insights.opportunities)
    : [];

  const mapsLead = {
    placeId: lead.placeId,
    name: lead.name,
    address: lead.address,
    mapsUrl: null,
  };

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

  const handleExportCsv = () => {
    if (!result) return;
    downloadHeatmapCsv(lead, result);
  };

  const handleExportPdf = async () => {
    if (!result || exportingPdf) return;
    setExportingPdf(true);
    try {
      await downloadHeatmapPdf(lead, result);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-zinc-50">
      {/* ── Header + metrics ── */}
      <header className="relative shrink-0 border-b border-slate-200/70 bg-white">
        <div className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" aria-hidden />

        <div className="flex items-start gap-3 px-5 pt-3.5 pb-3 pr-12">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
              {readOnly ? "Shared report" : "Local SEO heatmap"}
            </p>
            <h1 className="text-[17px] sm:text-lg font-semibold text-slate-900 tracking-tight truncate mt-1">
              {lead.name}
            </h1>
            <p className="text-xs text-slate-500 truncate mt-0.5">{lead.address}</p>
          </div>

          {result && (
            <div
              className="shrink-0 flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1 border"
              style={{
                backgroundColor: `${result.insights.gradeColor}10`,
                borderColor: `${result.insights.gradeColor}30`,
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ backgroundColor: result.insights.gradeColor }}
              >
                {result.insights.grade}
              </span>
              <span className="text-[10px] font-medium text-slate-600">Grade</span>
            </div>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}

        {!readOnly && (
          <div className="px-5 pb-3.5">
            <div className="flex gap-2 p-1 rounded-xl bg-slate-100/80 border border-slate-200/60">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  value={keyword}
                  onChange={(e) => onKeywordChange?.(e.target.value)}
                  disabled={scanning}
                  placeholder='Keyword — "plumber near me"'
                  className="w-full bg-white rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:opacity-50"
                  onKeyDown={(e) => e.key === "Enter" && onScan?.()}
                />
              </div>
              <button
                onClick={onScan}
                disabled={scanning || !keyword.trim()}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
              >
                {scanning ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" />
                    Scanning
                  </span>
                ) : (
                  "Scan area"
                )}
              </button>
            </div>
          </div>
        )}

        {readOnly && result && (
          <p className="px-5 pb-3 text-xs text-slate-500">
            Keyword <span className="text-slate-800 font-medium">{result.keyword}</span>
          </p>
        )}

        {result && (
          <div className="px-5 pb-3.5 pt-0 border-t border-slate-100 bg-slate-50/50">
            <div className="grid grid-cols-4 gap-2">
              <MetricTile
                label="Rank at pin"
                value={result.insights.businessRankLabel}
                accent={rankStyle?.backgroundColor ?? "#dc2626"}
              />
              <MetricTile
                label="Visibility"
                value={String(result.insights.visibilityScore)}
                accent={result.insights.gradeColor}
              />
              <MetricTile
                label="Top 3"
                value={`${result.summary.top3Percent}%`}
                accent="#059669"
              />
              <MetricTile
                label="Blind spots"
                value={`${result.summary.notRankingPercent}%`}
                accent="#dc2626"
              />
            </div>
            {result.insights.issues[0] && (
              <p className="mt-2 text-[11px] text-amber-800/90 flex items-center gap-1.5 truncate">
                <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                {result.insights.issues[0]}
              </p>
            )}
          </div>
        )}
      </header>

      {/* Meta + share */}
      <div className="shrink-0 bg-white border-b border-zinc-200/80 px-4 py-2.5">
        <ContactChips
          lead={lead}
          rating={rating}
          reviewCount={reviewCount}
          mapsLead={mapsLead}
        />

        {scanError && (
          <p className="text-xs text-red-600 mt-2.5 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
            {scanError}
          </p>
        )}

        {shareUrl && result && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link2 size={14} className="text-zinc-500 shrink-0" />
              <span className="text-xs text-zinc-600 truncate">{shareUrl}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 hover:border-zinc-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              <Copy size={12} />
              {copiedLink ? "Copied" : "Copy link"}
            </button>
          </div>
        )}

      </div>

      {/* ── Workspace ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Rankings */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col min-h-0 bg-white border-r border-zinc-200/80">
          <PanelHeader title="Rankings at pin" />
          {!result ? (
            <EmptyPanel text={readOnly ? "No data" : "Run a scan to see competitors."} />
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-3 space-y-1">
                {result.competitors.length > 0 ? (
                  result.competitors.map((c) => (
                    <CompetitorRow key={c.placeId} competitor={c} />
                  ))
                ) : (
                  <p className="text-xs text-zinc-400 py-4 text-center">No competitors found.</p>
                )}
              </div>
              <div className="shrink-0 px-4 py-3 border-t border-zinc-100 flex items-center gap-2">
                <ToolbarButton
                  onClick={handleCopyPitch}
                  title={copiedPitch ? "Copied" : "Copy pitch"}
                  active={copiedPitch}
                >
                  <Copy size={15} />
                </ToolbarButton>
                <ToolbarButton onClick={handleExportCsv} title="Export CSV">
                  <FileSpreadsheet size={15} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={handleExportPdf}
                  title="Export PDF"
                  disabled={exportingPdf}
                >
                  {exportingPdf ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <FileDown size={15} />
                  )}
                </ToolbarButton>
              </div>
            </div>
          )}
        </aside>

        {/* Map */}
        <main className="lg:col-span-6 flex flex-col min-h-0 min-h-[280px] bg-zinc-100 relative">
          {scanning && !result && <ScanningState />}
          {!result && !scanning && !readOnly && <ReadyState />}
          {result && (
            <div className="flex-1 min-h-0 relative p-2 flex flex-col">
              <HeatmapMapViewer
                mapUrl={result.mapUrl}
                gridSize={result.gridSize}
                gridCells={gridCells}
                className="flex-1 min-h-0 m-0"
              />
              <MapInfoOverlay
                open={mapInfoOpen}
                onToggle={() => setMapInfoOpen((v) => !v)}
                coverageInfo={coverageInfo}
                result={result}
              />
            </div>
          )}
        </main>

        {/* Insights */}
        <aside className="lg:col-span-3 flex flex-col min-h-0 bg-white border-t lg:border-t-0 lg:border-l border-zinc-200/80 max-h-[340px] lg:max-h-none">
          <PanelHeader title="Report insights" />
          {!result ? (
            <EmptyPanel text={readOnly ? "Unavailable" : "Insights appear after scan."} />
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4">
                {result.competitors.length > 0 && (
                  <div className="lg:hidden space-y-1">
                    <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                      Rankings
                    </p>
                    {result.competitors.map((c) => (
                      <CompetitorRow key={c.placeId} competitor={c} />
                    ))}
                  </div>
                )}
                <InsightBlock
                  title="Problems found"
                  items={result.insights.issues}
                  variant="issue"
                />
                <InsightBlock
                  title="How we can help"
                  items={howWeCanHelpItems}
                  variant="win"
                />
              </div>
              <div className="lg:hidden shrink-0 px-4 py-3 border-t border-zinc-100 flex justify-end gap-2">
                <ToolbarButton onClick={handleCopyPitch} title="Copy pitch" active={copiedPitch}>
                  <Copy size={15} />
                </ToolbarButton>
                <ToolbarButton onClick={handleExportCsv} title="CSV">
                  <FileSpreadsheet size={15} />
                </ToolbarButton>
                <ToolbarButton onClick={handleExportPdf} title="PDF" disabled={exportingPdf}>
                  {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                </ToolbarButton>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg bg-white border border-slate-200/70 px-2 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400 truncate">
        {label}
      </p>
      <p
        className="text-base sm:text-lg font-semibold tabular-nums leading-tight mt-0.5 truncate"
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="shrink-0 px-4 py-3 border-b border-zinc-100">
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-xs text-zinc-400 text-center">
      {text}
    </div>
  );
}

function ScanningState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
      <div className="w-12 h-12 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
      <p className="text-sm font-medium text-zinc-700">Scanning 7×7 grid</p>
      <p className="text-xs text-zinc-400">Live Google Maps · 30–60 seconds</p>
    </div>
  );
}

function ReadyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center">
        <MapPin size={24} className="text-zinc-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-800">Ready to scan</p>
        <p className="text-xs text-zinc-400 mt-1 max-w-[240px]">
          Enter a keyword and run a scan to generate your local visibility heatmap.
        </p>
      </div>
    </div>
  );
}

function MapInfoOverlay({
  open,
  onToggle,
  coverageInfo,
  result,
}: {
  open: boolean;
  onToggle: () => void;
  coverageInfo: ReturnType<typeof getHeatmapCoverageInfo> | null;
  result: HeatmapScanResult;
}) {
  return (
    <div className="absolute top-3 left-3 z-30 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Hide map info" : "Show map info"}
        aria-expanded={open}
        className={`w-9 h-9 flex items-center justify-center rounded-lg border shadow-sm transition-colors ${
          open
            ? "bg-zinc-900 border-zinc-800 text-white"
            : "bg-white border-zinc-200/90 text-zinc-600 hover:bg-zinc-50"
        }`}
      >
        {open ? <X size={16} /> : <Info size={16} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="w-[220px] rounded-xl bg-white border border-zinc-200 shadow-xl p-3 space-y-3"
          >
            <div>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                Legend
              </p>
              <div className="space-y-1">
                {HEATMAP_LEGEND.map((item) => (
                  <div key={item.legendLabel} className="flex items-center gap-2 text-[11px] text-zinc-600">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.backgroundColor }}
                    />
                    {item.legendLabel}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 pt-2 border-t border-zinc-100 flex items-center gap-1">
                <MapPin size={10} className="text-blue-600 fill-blue-600" />
                Blue pin = your business
              </p>
            </div>
            {coverageInfo && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-2.5">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                  Coverage
                </p>
                <p className="text-xs font-semibold text-zinc-800 mt-1">{coverageInfo.shortLabel}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                  {coverageInfo.detailLabel}
                </p>
                <div className="mt-2 pt-2 border-t border-zinc-200/60 space-y-1">
                  <MiniStat label="Avg rank" value={String(result.summary.avgRank)} />
                  <MiniStat label="Page 1" value={`${result.summary.page1Percent}%`} />
                  <MiniStat label="Top 3" value={`${result.summary.top3Percent}%`} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CompetitorRow({ competitor: c }: { competitor: HeatmapCompetitor }) {
  const rankBadge = getRankStyle(c.rank);
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs ${
        c.isTarget
          ? "bg-blue-50 border border-blue-100"
          : "hover:bg-zinc-50 border border-transparent"
      }`}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: rankBadge.backgroundColor }}
      >
        {rankBadge.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-zinc-800 ${c.isTarget ? "font-semibold" : ""}`}>
          {c.name}
          {c.isTarget && <span className="text-blue-600 font-normal ml-1">· you</span>}
        </p>
        <p className="text-[10px] text-zinc-400 mt-0.5">
          {c.rating != null ? `${c.rating.toFixed(1)} ★` : "—"}
          {c.userRatingsTotal != null && ` · ${c.userRatingsTotal.toLocaleString()}`}
        </p>
      </div>
    </div>
  );
}

function InsightBlock({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "issue" | "win";
}) {
  const isIssue = variant === "issue";
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">None identified.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className={`flex gap-2 text-xs leading-relaxed rounded-lg px-2.5 py-2 ${
                isIssue
                  ? "bg-red-50/80 text-red-800 border border-red-100/80"
                  : "bg-emerald-50/80 text-emerald-800 border border-emerald-100/80"
              }`}
            >
              {isIssue ? (
                <AlertTriangle size={13} className="shrink-0 mt-0.5 text-red-500" />
              ) : (
                <CheckCircle2 size={13} className="shrink-0 mt-0.5 text-emerald-500" />
              )}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  children,
  active = false,
  disabled = false,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${
        active
          ? "bg-emerald-600 border-emerald-600 text-white"
          : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}

function ContactChips({
  lead,
  rating,
  reviewCount,
  mapsLead,
}: {
  lead: PublicHeatmapLeadSnapshot;
  rating: number | null;
  reviewCount: number | null;
  mapsLead: { placeId: string; name: string; address: string; mapsUrl: null };
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600">
      {lead.searchCategory && (
        <span className="text-zinc-500">{lead.searchCategory}</span>
      )}
      {(rating != null || reviewCount != null) && (
        <span className="flex items-center gap-1">
          <Star size={12} className="text-amber-400 fill-amber-400" />
          <span className="font-medium text-zinc-800">{rating?.toFixed(1) ?? "—"}</span>
          {reviewCount != null && (
            <span className="text-zinc-400">({reviewCount.toLocaleString()})</span>
          )}
        </span>
      )}
      {lead.phone && lead.phone !== "N/A" && (
        <span className="flex items-center gap-1 text-zinc-500">
          <Phone size={11} />
          {lead.phone}
        </span>
      )}
      {lead.email && (
        <span className="flex items-center gap-1 truncate max-w-[180px] text-zinc-500">
          <Mail size={11} />
          {lead.email}
        </span>
      )}
      <a
        href={getLeadMapsUrl(mapsLead)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-zinc-700 hover:text-zinc-900 transition"
      >
        <MapPin size={11} />
        Maps
        <ExternalLink size={10} />
      </a>
      {lead.website && lead.website !== "N/A" ? (
        <a
          href={lead.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-700 hover:text-zinc-900 truncate max-w-[160px] transition"
        >
          Website ↗
        </a>
      ) : (
        <span className="text-red-500">No website</span>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-800 tabular-nums">{value}</span>
    </div>
  );
}
