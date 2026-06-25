import type {
  AuditDashboard,
  AuditIssueRow,
  AuditScoreCard,
  CrawlBreakdown,
  CrawledPageSummary,
  HtmlMetaReport,
  SiteAuditInsights,
  TechnicalSeoReport,
  ThematicReport,
} from "@/lib/types/site-audit";

export function buildAuditDashboard(params: {
  scores: AuditScoreCard;
  insights: SiteAuditInsights;
  htmlMeta: HtmlMetaReport;
  technicalSeo: TechnicalSeoReport | null;
}): AuditDashboard {
  const { scores, insights, htmlMeta, technicalSeo } = params;

  const siteHealth = insights.overallScore;
  const aiSearchHealth = technicalSeo?.aiSearchHealth ?? Math.round(scores.seo * 0.85);

  const crawlBreakdown =
    technicalSeo?.crawlBreakdown ??
    deriveCrawlBreakdown(technicalSeo?.crawledPages ?? []);

  const aiBots = technicalSeo?.aiBots ?? [];
  const issueTable =
    technicalSeo?.issueInventory ??
    buildFallbackIssues(technicalSeo, htmlMeta);

  const errors = issueTable.filter((i) => i.severity === "error").length;
  const warnings = issueTable.filter((i) => i.severity === "warning").length;

  const thematicReports = buildThematicReports(scores, technicalSeo, htmlMeta);

  return {
    siteHealth,
    siteHealthLabel: insights.gradeLabel,
    benchmarkHealth: 92,
    aiSearchHealth,
    aiSearchHealthLabel:
      aiSearchHealth >= 80
        ? "Website is better optimized for AI search engines"
        : aiSearchHealth >= 60
          ? "AI search visibility needs improvement"
          : "Poor AI search optimization — bots may not index content",
    crawlBreakdown,
    aiBots,
    issueSummary: { errors, warnings },
    issueTable,
    thematicReports,
    llmsTxtFound: technicalSeo?.llmsTxt.found ?? false,
  };
}

function deriveCrawlBreakdown(pages: CrawledPageSummary[]): CrawlBreakdown {
  const breakdown: CrawlBreakdown = {
    total: pages.length,
    healthy: 0,
    broken: 0,
    haveIssues: 0,
    redirects: 0,
    blocked: 0,
  };

  for (const page of pages) {
    const cat =
      page.category ??
      (page.status >= 400
        ? "broken"
        : page.issue
          ? "haveIssues"
          : "healthy");
    if (cat === "healthy") breakdown.healthy++;
    else if (cat === "broken") breakdown.broken++;
    else if (cat === "haveIssues") breakdown.haveIssues++;
    else if (cat === "redirect") breakdown.redirects++;
    else if (cat === "blocked") breakdown.blocked++;
  }

  return breakdown;
}

function buildFallbackIssues(
  technical: TechnicalSeoReport | null,
  htmlMeta: HtmlMetaReport
): AuditIssueRow[] {
  const issues: AuditIssueRow[] = [];
  if (htmlMeta.h1.length === 0) {
    issues.push({
      id: "missing-h1",
      title: "Missing h1",
      pagesAffected: 1,
      severity: "warning",
      howToFix: "Add a descriptive H1 heading on the homepage.",
    });
  }
  if (!technical?.ssl.secure) {
    issues.push({
      id: "no-https",
      title: "Site not using HTTPS",
      pagesAffected: 1,
      severity: "error",
      howToFix: "Install SSL and redirect HTTP to HTTPS.",
    });
  }
  return issues;
}

function buildThematicReports(
  scores: AuditScoreCard,
  technical: TechnicalSeoReport | null,
  htmlMeta: HtmlMetaReport
): ThematicReport[] {
  const crawlScore = technical
    ? Math.round(
        (technical.crawlBreakdown.healthy / Math.max(technical.crawlBreakdown.total, 1)) * 100
      )
    : null;

  return [
    {
      id: "robots",
      title: "Robots.txt",
      score: technical?.robotsTxt.found ? 100 : 0,
      status: (technical?.robotsTxt.found ? "good" : "warning") as ThematicReport["status"],
      note: technical?.robotsTxt.found ? "File found" : "Not found",
    },
    {
      id: "crawlability",
      title: "Crawlability",
      score: crawlScore,
      status: (
        crawlScore == null ? "na" : crawlScore >= 80 ? "good" : crawlScore >= 50 ? "warning" : "error"
      ) as ThematicReport["status"],
    },
    {
      id: "https",
      title: "HTTPS",
      score: technical?.ssl.secure ? 98 : 40,
      status: (technical?.ssl.secure ? "good" : "error") as ThematicReport["status"],
      note: technical?.ssl.note,
    },
    {
      id: "performance",
      title: "Site Performance",
      score: scores.performance,
      status: (scores.performance >= 80 ? "good" : scores.performance >= 50 ? "warning" : "error") as ThematicReport["status"],
    },
    {
      id: "seo",
      title: "On-Page SEO",
      score: scores.seo,
      status: (scores.seo >= 80 ? "good" : scores.seo >= 50 ? "warning" : "error") as ThematicReport["status"],
    },
    {
      id: "markup",
      title: "Markup",
      score: htmlMeta.hasStructuredData ? 90 : htmlMeta.hasOgTags ? 70 : 40,
      status: (htmlMeta.hasStructuredData ? "good" : "warning") as ThematicReport["status"],
      note: htmlMeta.hasStructuredData ? "Schema detected" : "No structured data",
    },
    {
      id: "ai-search",
      title: "AI Search",
      score: technical?.aiSearchHealth ?? null,
      status: (
        (technical?.aiSearchHealth ?? 0) >= 80
          ? "good"
          : (technical?.aiSearchHealth ?? 0) >= 60
            ? "warning"
            : "error"
      ) as ThematicReport["status"],
    },
    {
      id: "rendering",
      title: "SSR / CSR",
      score:
        technical?.rendering.mode === "ssr"
          ? 95
          : technical?.rendering.mode === "hybrid"
            ? 75
            : technical?.rendering.mode === "csr"
              ? 35
              : 50,
      status: (
        technical?.rendering.mode === "csr"
          ? "error"
          : technical?.rendering.mode === "hybrid"
            ? "warning"
            : "good"
      ) as ThematicReport["status"],
      note: technical?.rendering.summary,
    },
  ];
}
