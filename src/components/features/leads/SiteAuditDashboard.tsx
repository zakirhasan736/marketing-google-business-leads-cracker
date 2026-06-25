"use client";

import { useState, type ReactNode } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  XCircle,
} from "lucide-react";
import type { AuditDashboard, AuditMetric, SiteAuditResult } from "@/lib/types/site-audit";

interface SiteAuditDashboardProps {
  result: SiteAuditResult;
  dashboard: AuditDashboard;
  deviceLabel?: string;
}

function scoreColor(value: number): string {
  if (value >= 90) return "#10b981";
  if (value >= 70) return "#8b5cf6";
  if (value >= 50) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(value: number): string {
  if (value >= 90) return "Excellent";
  if (value >= 70) return "Good";
  if (value >= 50) return "Needs work";
  return "Poor";
}

export function SiteAuditDashboard({ result, dashboard, deviceLabel }: SiteAuditDashboardProps) {
  const [expandedBots, setExpandedBots] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const crawl = dashboard.crawlBreakdown;
  const displayBots = expandedBots ? dashboard.aiBots : dashboard.aiBots.slice(0, 4);
  const aiIssueCount = dashboard.issueTable.filter((i) => i.tag === "AI Search").length;

  return (
    <div className="space-y-5">
      {/* Clean summary row (like your screenshot) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryGaugeCard
          title="Site Health"
          value={dashboard.siteHealth}
          label={scoreLabel(dashboard.siteHealth)}
          footer={
            <p className="text-xs text-slate-500">
              Your site: <strong className="text-slate-800">{dashboard.siteHealth}%</strong>{" "}
              <span className="text-slate-400">·</span> Top sites: {dashboard.benchmarkHealth}%
            </p>
          }
          chip={deviceLabel ? { text: deviceLabel } : undefined}
        />

        <SummaryGaugeCard
          title="AI Search Health"
          value={dashboard.aiSearchHealth}
          label={scoreLabel(dashboard.aiSearchHealth)}
          badge="BETA"
          footer={
            <p className="text-xs text-slate-500 line-clamp-2">{dashboard.aiSearchHealthLabel}</p>
          }
          hint={aiIssueCount > 0 ? `${aiIssueCount} AI issue${aiIssueCount === 1 ? "" : "s"}` : undefined}
        />

        <PagesCrawledCard crawl={crawl} />
      </div>

      {/* Lighthouse bars */}
      <Card>
        <CardTitle title="Google Lighthouse scores" subtitle="Higher is better — aim for 90+" />
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ScoreBar label="Performance" value={result.scores.performance} />
          <ScoreBar label="SEO" value={result.scores.seo} />
          <ScoreBar label="Accessibility" value={result.scores.accessibility} />
          <ScoreBar label="Best Practices" value={result.scores.bestPractices} />
        </div>
      </Card>

      {/* Core Web Vitals */}
      {result.metrics.length > 0 && (
        <Card>
          <CardTitle title="Core Web Vitals" subtitle="Real user experience metrics" />
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.metrics.slice(0, 6).map((m) => (
              <MetricTile key={m.id} metric={m} />
            ))}
          </div>
        </Card>
      )}

      {/* AI bots + issues */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardTitle
            icon={<Bot size={16} />}
            title="AI & search crawlers"
            subtitle={`${crawl.total} pages checked for bot access`}
          />
          <ul className="mt-3 space-y-2">
            {displayBots.map((bot) => (
              <li
                key={bot.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{bot.name}</p>
                  <p className="text-xs text-slate-500 truncate">{bot.message}</p>
                </div>
                <BotStatusPill status={bot.status} />
              </li>
            ))}
          </ul>
          {dashboard.aiBots.length > 4 && (
            <button
              type="button"
              onClick={() => setExpandedBots((v) => !v)}
              className="mt-3 text-sm text-violet-600 font-medium hover:text-violet-800 inline-flex items-center gap-1"
            >
              {expandedBots ? (
                <>
                  <ChevronUp size={14} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Show all {dashboard.aiBots.length} bots
                </>
              )}
            </button>
          )}
        </Card>

        <Card>
          <CardTitle
            icon={<CircleAlert size={16} />}
            title="Issues to fix"
            subtitle={`${dashboard.issueSummary.errors} errors · ${dashboard.issueSummary.warnings} warnings`}
          />
          {dashboard.issueTable.length > 0 ? (
            <ul className="mt-3 space-y-2 max-h-[320px] overflow-y-auto scrollbar-thin pr-1">
              {dashboard.issueTable.map((issue) => {
                const open = expandedIssue === issue.id;
                return (
                  <li
                    key={issue.id}
                    className={`rounded-xl border overflow-hidden transition ${
                      issue.severity === "error"
                        ? "border-red-100 bg-red-50/50"
                        : "border-amber-100 bg-amber-50/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedIssue(open ? null : issue.id)}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left"
                    >
                      {issue.severity === "error" ? (
                        <XCircle size={18} className="text-red-500 shrink-0" />
                      ) : (
                        <CircleAlert size={18} className="text-amber-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{issue.title}</span>
                          {issue.tag && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              {issue.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {issue.pagesAffected} {issue.pagesAffected === 1 ? "page" : "pages"} affected
                        </p>
                      </div>
                      {open ? (
                        <ChevronUp size={16} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {open && (
                      <div className="px-3 pb-3 pt-0">
                        <p className="text-sm text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-100 leading-relaxed">
                          <span className="font-semibold text-slate-800">How to fix: </span>
                          {issue.howToFix}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4 flex flex-col items-center py-6 text-center">
              <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
              <p className="text-sm font-medium text-slate-700">No major issues found</p>
              <p className="text-xs text-slate-500 mt-1">Site looks healthy from our crawl</p>
            </div>
          )}
        </Card>
      </div>

      {/* Thematic reports */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Health by category</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {dashboard.thematicReports.map((report) => (
            <ThematicCard key={report.id} report={report} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function SummaryGaugeCard(props: {
  title: string;
  value: number;
  label: string;
  badge?: string;
  chip?: { text: string };
  hint?: string;
  footer: ReactNode;
}) {
  const color = "#7c3aed";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-visible">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800">{props.title}</p>
            {props.badge && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {props.badge}
              </span>
            )}
            {props.chip && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {props.chip.text}
              </span>
            )}
          </div>
          {props.hint && (
            <p className="text-[11px] text-violet-700 mt-1 font-medium">{props.hint}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center min-h-[132px] justify-center">
        <SemiCircleGauge value={props.value} label={props.label} color={color} />
      </div>

      <div className="mt-1 border-t border-slate-100 pt-3">{props.footer}</div>
    </div>
  );
}

function SemiCircleGauge({
  value,
  label,
  color = "#7c3aed",
}: {
  value: number;
  label: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const width = 220;
  const height = 128;
  const stroke = 12;
  const radius = 78;
  const cx = width / 2;
  const cy = height - 16;

  const arcPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
  const arcLength = Math.PI * radius;
  const dashOffset = arcLength - (pct / 100) * arcLength;

  return (
    <div className="relative w-full max-w-[220px] mx-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[96px] block overflow-visible"
        role="img"
        aria-label={`${pct}% ${label}`}
      >
        <path
          d={arcPath}
          fill="none"
          stroke="#e8edf4"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={arcPath}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center pointer-events-none">
        <span className="text-[32px] leading-none font-black text-violet-700 tabular-nums">
          {pct}%
        </span>
        <span className="text-xs text-slate-500 font-medium mt-1">{label}</span>
      </div>
    </div>
  );
}

function PagesCrawledCard({ crawl }: { crawl: AuditDashboard["crawlBreakdown"] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Pages crawled</p>
        <p className="text-xs text-slate-400 mt-0.5">{crawl.total} pages analyzed</p>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <DonutChart crawl={crawl} />
        <CrawlLegendList crawl={crawl} />
      </div>
    </div>
  );
}

function CardTitle({
  title,
  subtitle,
  badge,
  icon,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 w-full">
      <div className="flex items-start gap-2">
        {icon && <span className="text-violet-500 mt-0.5">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {badge && (
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">
          {badge}
        </span>
      )}
    </div>
  );
}

function DonutChart({ crawl }: { crawl: AuditDashboard["crawlBreakdown"] }) {
  const total = Math.max(crawl.total, 1);
  const segments = [
    { count: crawl.healthy, color: "#22c55e" },
    { count: crawl.broken, color: "#ef4444" },
    { count: crawl.haveIssues, color: "#f97316" },
    { count: crawl.redirects, color: "#3b82f6" },
    { count: crawl.blocked, color: "#94a3b8" },
  ].filter((s) => s.count > 0);

  const r = 36;
  const cx = 44;
  const cy = 44;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {segments.map((seg, i) => {
          const dash = (seg.count / total) * circumference;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-800 tabular-nums">{crawl.total}</span>
        <span className="text-[10px] text-slate-500 font-medium">pages</span>
      </div>
    </div>
  );
}

function CrawlLegendList({ crawl }: { crawl: AuditDashboard["crawlBreakdown"] }) {
  const items = [
    { label: "Healthy", count: crawl.healthy, color: "bg-emerald-500" },
    { label: "Broken", count: crawl.broken, color: "bg-red-500" },
    { label: "Issues", count: crawl.haveIssues, color: "bg-orange-500" },
    { label: "Redirects", count: crawl.redirects, color: "bg-blue-500" },
    { label: "Blocked", count: crawl.blocked, color: "bg-slate-400" },
  ];

  return (
    <ul className="flex-1 space-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            {item.label}
          </span>
          <span className="font-semibold text-slate-800 tabular-nums">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {value}
          <span className="text-slate-400 font-normal">/100</span>
        </span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function MetricTile({ metric }: { metric: AuditMetric }) {
  const score = metric.score ?? 0;
  const color = scoreColor(score);
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
      <p className="text-xs text-slate-500 truncate">{metric.label}</p>
      <div className="flex items-end justify-between gap-2 mt-1">
        <p className="text-lg font-bold text-slate-900 tabular-nums">{metric.value}</p>
        {metric.score != null && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {metric.score}
          </span>
        )}
      </div>
    </div>
  );
}

function BotStatusPill({ status }: { status: "ok" | "blocked" | "limited" }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
        <CheckCircle2 size={14} />
        OK
      </span>
    );
  }
  if (status === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-full shrink-0">
        <XCircle size={14} />
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full shrink-0">
      <CircleAlert size={14} />
      Limited
    </span>
  );
}

function ThematicCard({
  report,
}: {
  report: AuditDashboard["thematicReports"][number];
}) {
  const statusMap = {
    good: { label: "Healthy", className: "text-emerald-600 bg-emerald-50" },
    warning: { label: "Needs work", className: "text-amber-600 bg-amber-50" },
    error: { label: "Issues", className: "text-red-600 bg-red-50" },
    na: { label: "N/A", className: "text-slate-500 bg-slate-100" },
    info: { label: "Info", className: "text-slate-500 bg-slate-100" },
  };
  const status = statusMap[report.status] ?? statusMap.na;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col min-h-[110px] hover:border-violet-200 hover:shadow-sm transition">
      <p className="text-xs font-semibold text-slate-700">{report.title}</p>
      {report.score != null ? (
        <div className="flex-1 flex items-center justify-center my-2">
          <RingScore value={report.score} />
        </div>
      ) : (
        <p className="text-xs text-slate-400 flex-1 flex items-center my-2 leading-snug">
          {report.note ?? "Not available"}
        </p>
      )}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${status.className}`}>
        {status.label}
      </span>
    </div>
  );
}

function RingScore({ value }: { value: number }) {
  const color = scoreColor(value);
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#f1f5f9" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800 tabular-nums">
        {value}%
      </span>
    </div>
  );
}

export function AiCrawlSummary({ dashboard }: { dashboard: AuditDashboard }) {
  const blocked = dashboard.aiBots.filter((b) => b.status !== "ok");
  if (blocked.length === 0) return null;

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3">
      <p className="text-sm font-semibold text-violet-900 flex items-center gap-2">
        <Bot size={16} />
        AI crawlers need attention
      </p>
      <ul className="mt-2 space-y-1.5">
        {blocked.map((bot) => (
          <li key={bot.id} className="flex items-start gap-2 text-sm text-violet-800">
            <CircleAlert size={14} className="shrink-0 mt-0.5 text-violet-500" />
            <span>
              <strong>{bot.name}</strong> — {bot.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
