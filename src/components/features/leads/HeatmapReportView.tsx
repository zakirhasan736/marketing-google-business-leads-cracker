"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Star,
} from "lucide-react";
import { HeatmapMapViewer } from "@/components/features/leads/HeatmapMapViewer";
import type { HeatmapScanResult, PublicHeatmapLeadSnapshot } from "@/lib/types/heatmap";
import { getRankStyle, HEATMAP_LEGEND } from "@/lib/utils/heatmap-colors";
import { getLeadMapsUrl } from "@/lib/utils/google-maps";

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
}: HeatmapReportViewProps) {
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-50">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-neutral-200 px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {readOnly ? "Shared SEO Report" : "SEO Report"}
              </span>
              {result && (
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-white px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: result.insights.gradeColor }}
                >
                  Grade {result.insights.grade}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 truncate mt-1">
              {lead.name}
            </h1>
            <p className="text-xs text-neutral-500 truncate">{lead.address}</p>
            <ContactChips lead={lead} rating={rating} reviewCount={reviewCount} mapsLead={mapsLead} />
          </div>
        </div>

        {!readOnly && (
          <div className="flex gap-2 mt-3">
            <input
              value={keyword}
              onChange={(e) => onKeywordChange?.(e.target.value)}
              disabled={scanning}
              placeholder='Keyword — e.g. "HVAC near me"'
              className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
              onKeyDown={(e) => e.key === "Enter" && onScan?.()}
            />
            <button
              onClick={onScan}
              disabled={scanning || !keyword.trim()}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition"
            >
              {scanning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
              {scanning ? "Scanning…" : "Scan Area"}
            </button>
          </div>
        )}

        {readOnly && result && (
          <p className="text-xs text-neutral-500 mt-2">
            Keyword: <strong className="text-neutral-700">{result.keyword}</strong>
          </p>
        )}

        {scanError && (
          <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2">
            {scanError}
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
              className="shrink-0 text-xs font-semibold bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Copy size={12} />
              {copiedLink ? "Link copied!" : "Copy client link"}
            </button>
          </div>
        )}
      </header>

      {/* KPI strip */}
      {result && (
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-px bg-neutral-200 border-b border-neutral-200">
          <KpiCell
            label="Your rank at pin"
            value={result.insights.businessRankLabel}
            color={rankStyle?.backgroundColor ?? "#dc2626"}
            sub="At your business location"
          />
          <KpiCell
            label="Visibility score"
            value={`${result.insights.visibilityScore}`}
            color={result.insights.gradeColor}
            sub={result.insights.gradeLabel}
          />
          <KpiCell
            label="Top 3 coverage"
            value={`${result.summary.top3Percent}%`}
            color="#22c55e"
            sub={`${result.summary.top3Count}/${result.cells.length} points`}
          />
          <KpiCell
            label="Blind spots"
            value={`${result.summary.notRankingPercent}%`}
            color="#dc2626"
            sub={`${result.summary.notRankingCount} areas off page 1`}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        <aside className="hidden lg:flex lg:col-span-2 flex-col border-r border-neutral-200 bg-white overflow-y-auto">
          {result ? (
            <div className="p-4 space-y-4">
              <SectionLabel>Legend</SectionLabel>
              <div className="space-y-1.5">
                {HEATMAP_LEGEND.map((item) => (
                  <div
                    key={item.legendLabel}
                    className="flex items-center gap-2 text-[11px] text-neutral-600"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.backgroundColor }}
                    />
                    {item.legendLabel}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-medium pt-2 border-t border-neutral-100">
                <MapPin size={11} className="fill-blue-600 text-blue-600" />
                Blue pin = your business
              </div>
              <SectionLabel>Coverage</SectionLabel>
              <MiniStat label="Avg rank" value={String(result.summary.avgRank)} />
              <MiniStat label="Page 1" value={`${result.summary.page1Percent}%`} />
              <MiniStat label="Top 3" value={`${result.summary.top3Percent}%`} />
              <MiniStat label="Keyword" value={result.keyword} small />
            </div>
          ) : (
            <div className="p-4 text-xs text-neutral-400">
              {readOnly ? "No data" : "Scan to see legend and stats."}
            </div>
          )}
        </aside>

        <main className="lg:col-span-7 flex flex-col min-h-0 bg-neutral-100 min-h-[280px] lg:min-h-0">
          {scanning && !result && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
              <Loader2 size={36} className="animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-neutral-700">
                Scanning 7×7 grid…
              </p>
              <p className="text-xs text-neutral-400 text-center max-w-xs">
                Live Google Maps search — 30–60 seconds
              </p>
            </div>
          )}

          {!result && !scanning && !readOnly && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border flex items-center justify-center shadow-sm">
                <MapPin size={28} className="text-blue-500" />
              </div>
              <p className="font-semibold text-neutral-700">Ready to scan</p>
              <p className="text-sm text-neutral-400 max-w-sm">
                Click <strong>Scan Area</strong> to generate the heatmap and a
                shareable client link.
              </p>
            </div>
          )}

          {result && (
            <HeatmapMapViewer
              mapUrl={result.mapUrl}
              gridSize={result.gridSize}
              gridCells={gridCells}
            />
          )}
        </main>

        <aside className="lg:col-span-3 flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-neutral-200 bg-white overflow-hidden max-h-[320px] lg:max-h-none">
          {!result ? (
            <div className="flex-1 flex items-center justify-center p-6 text-xs text-neutral-400 text-center">
              {readOnly
                ? "Report data unavailable."
                : "Competitors and insights appear after scan."}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              {result.competitors.length > 0 && (
                <div className="shrink-0 border-b border-neutral-100 p-4">
                  <SectionLabel>Rankings at your pin</SectionLabel>
                  <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto pr-1">
                    {result.competitors.map((c) => (
                      <div
                        key={c.placeId}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                          c.isTarget
                            ? "bg-blue-50 border border-blue-200 font-semibold"
                            : "bg-neutral-50"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                            c.isTarget ? "bg-blue-600" : "bg-neutral-400"
                          }`}
                        >
                          {c.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-neutral-800">
                            {c.name}
                            {c.isTarget && (
                              <span className="text-blue-600 ml-1">← YOU</span>
                            )}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {c.rating != null ? `${c.rating.toFixed(1)}★` : "—"}
                            {c.userRatingsTotal != null &&
                              ` · ${c.userRatingsTotal.toLocaleString()} reviews`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                <CompactInsightList
                  title="Problems found"
                  items={result.insights.issues}
                  variant="issue"
                />
                <CompactInsightList
                  title="How we can help"
                  items={result.insights.opportunities}
                  variant="win"
                />
              </div>

              <div className="shrink-0 border-t border-neutral-200 p-4 bg-neutral-50">
                <SectionLabel>Outreach pitch</SectionLabel>
                <p className="text-[11px] text-neutral-500 mt-1 mb-2 line-clamp-3 leading-relaxed">
                  {result.insights.pitch}
                </p>
                <button
                  type="button"
                  onClick={handleCopyPitch}
                  className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2.5 rounded-xl transition"
                >
                  <Copy size={13} />
                  {copiedPitch ? "Copied!" : "Copy pitch message"}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-neutral-600">
      {lead.searchCategory && (
        <span className="bg-neutral-100 px-2 py-0.5 rounded-md font-medium">
          {lead.searchCategory}
        </span>
      )}
      {(rating != null || reviewCount != null) && (
        <span className="flex items-center gap-1">
          <Star size={12} className="text-amber-400 fill-amber-400" />
          <strong>{rating?.toFixed(1) ?? "—"}</strong>
          {reviewCount != null && (
            <span className="text-neutral-400">
              ({reviewCount.toLocaleString()} reviews)
            </span>
          )}
        </span>
      )}
      {lead.phone && lead.phone !== "N/A" && (
        <span className="flex items-center gap-1">
          <Phone size={11} />
          {lead.phone}
        </span>
      )}
      {lead.email && (
        <span className="flex items-center gap-1 truncate max-w-[180px]">
          <Mail size={11} />
          {lead.email}
        </span>
      )}
      <a
        href={getLeadMapsUrl(mapsLead)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-blue-600 hover:underline"
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
          className="text-blue-600 hover:underline truncate max-w-[160px]"
        >
          Website ↗
        </a>
      ) : (
        <span className="text-red-500 font-medium">No website</span>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
      {children}
    </p>
  );
}

function KpiCell({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub: string;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-black leading-tight" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <span
        className={`font-bold text-neutral-800 text-right ${small ? "text-[10px] max-w-[100px] truncate" : "text-sm"}`}
      >
        {value}
      </span>
    </div>
  );
}

function CompactInsightList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "issue" | "win";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className={`flex items-start gap-1.5 text-[11px] leading-snug ${
              variant === "issue" ? "text-red-700" : "text-green-700"
            }`}
          >
            {variant === "issue" ? (
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={11} className="shrink-0 mt-0.5" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
