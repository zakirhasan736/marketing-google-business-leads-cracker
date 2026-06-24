import * as cheerio from "cheerio";
import { getGoogleMapsApiKey } from "@/server/config/env";
import { getLocalSearchRank } from "@/server/services/heatmap.service";
import { buildSiteAuditInsights } from "@/lib/utils/site-audit-insights";
import type {
  AuditFinding,
  AuditMetric,
  AuditScoreCard,
  HtmlMetaReport,
  KeywordReport,
  SiteAuditResult,
} from "@/lib/types/site-audit";

const NOT_RANKED = 21;

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: Record<
      string,
      { score?: number | null; title?: string }
    >;
    audits?: Record<
      string,
      {
        id?: string;
        title?: string;
        description?: string;
        score?: number | null;
        scoreDisplayMode?: string;
        displayValue?: string;
        numericValue?: number;
      }
    >;
  };
  error?: { message?: string };
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "N/A") {
    throw new Error("No valid website URL for this lead");
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function scoreTo100(score: number | null | undefined): number {
  if (score == null) return 0;
  return Math.round(score * 100);
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);
}

async function runPageSpeed(
  url: string,
  strategy: "mobile" | "desktop"
): Promise<PageSpeedResponse> {
  const apiKey = getGoogleMapsApiKey();
  const params = new URLSearchParams({
    url,
    strategy,
    key: apiKey,
  });
  params.append("category", "performance");
  params.append("category", "accessibility");
  params.append("category", "seo");
  params.append("category", "best-practices");

  const response = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
    { signal: AbortSignal.timeout(90000) }
  );

  if (!response.ok) {
    throw new Error(
      `PageSpeed API failed (${response.status}). Enable PageSpeed Insights API in Google Cloud Console.`
    );
  }

  return response.json();
}

function parseScores(data: PageSpeedResponse): AuditScoreCard {
  const cats = data.lighthouseResult?.categories ?? {};
  return {
    performance: scoreTo100(cats.performance?.score),
    accessibility: scoreTo100(cats.accessibility?.score),
    seo: scoreTo100(cats.seo?.score),
    bestPractices: scoreTo100(cats["best-practices"]?.score),
  };
}

const METRIC_IDS = [
  { id: "first-contentful-paint", label: "First Contentful Paint" },
  { id: "speed-index", label: "Speed Index" },
  { id: "largest-contentful-paint", label: "Largest Contentful Paint" },
  { id: "total-blocking-time", label: "Total Blocking Time" },
  { id: "cumulative-layout-shift", label: "Cumulative Layout Shift" },
  { id: "interactive", label: "Time to Interactive" },
];

function parseMetrics(data: PageSpeedResponse): AuditMetric[] {
  const audits = data.lighthouseResult?.audits ?? {};
  return METRIC_IDS.map(({ id, label }) => {
    const audit = audits[id];
    return {
      id,
      label,
      value: audit?.displayValue ?? "—",
      score: audit?.score != null ? scoreTo100(audit.score) : null,
    };
  });
}

function parseFindings(data: PageSpeedResponse): AuditFinding[] {
  const audits = data.lighthouseResult?.audits ?? {};
  const findings: AuditFinding[] = [];

  for (const audit of Object.values(audits)) {
    if (!audit?.title || audit.score == null || audit.score >= 0.9) continue;
    if (audit.scoreDisplayMode === "notApplicable") continue;

    const category = audit.id?.includes("accessibility")
      ? "accessibility"
      : audit.id?.includes("seo") || audit.id?.startsWith("meta-")
        ? "seo"
        : "performance";

    findings.push({
      id: audit.id ?? audit.title,
      title: audit.title,
      description: audit.description?.replace(/<[^>]+>/g, "").slice(0, 200) ?? "",
      category: category as AuditFinding["category"],
      severity: audit.score < 0.5 ? "critical" : "warning",
    });

    if (findings.length >= 15) break;
  }

  return findings;
}

async function analyzeHtml(url: string): Promise<{
  htmlMeta: HtmlMetaReport;
  keywords: KeywordReport;
  extraFindings: AuditFinding[];
}> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SiteAuditBot/1.0; +https://leadgen.local)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Could not fetch website (${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  $("script, style, noscript").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const htmlLen = html.length || 1;
  const textToHtmlRatio = Math.round((bodyText.length / htmlLen) * 1000) / 10;

  const title = $("title").first().text().trim() || null;
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;
  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const h2Count = $("h2").length;
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const hasCanonical = $('link[rel="canonical"]').length > 0;
  const robots = $('meta[name="robots"]').attr("content") ?? "";
  const hasRobotsMeta = robots.length > 0;
  const hasStructuredData =
    $('script[type="application/ld+json"]').length > 0;
  const hasOgTags = $('meta[property^="og:"]').length > 0;
  const scriptCount = html.match(/<script/gi)?.length ?? 0;
  const hasNoscriptOnly =
    bodyText.length < 100 && scriptCount > 5;
  const ssrLikely = wordCount >= 150 && !hasNoscriptOnly;
  const ssrNote = ssrLikely
    ? "Server-rendered content detected — good for SEO crawlers"
    : hasNoscriptOnly
      ? "Heavy JavaScript shell — content may not render for Google without SSR"
      : "Thin content detected — page may not rank well";

  const htmlMeta: HtmlMetaReport = {
    title,
    description,
    h1,
    h2Count,
    hasViewport,
    hasCanonical,
    hasRobotsMeta,
    hasStructuredData,
    hasOgTags,
    imageCount: $("img").length,
    linkCount: $("a[href]").length,
    wordCount,
    textToHtmlRatio,
    ssrLikely,
    ssrNote,
  };

  const fromTitle = title ? extractKeywords(title) : [];
  const fromDescription = description ? extractKeywords(description) : [];
  const fromH1 = h1.flatMap(extractKeywords);
  const fromBody = extractKeywords(bodyText).slice(0, 15);

  const allKw = new Set([...fromTitle, ...fromH1]);
  const missingOpportunities: string[] = [];
  if (!description) missingOpportunities.push("meta description keywords");
  if (h1.length === 0) missingOpportunities.push("primary H1 keyword");
  if (!hasStructuredData) missingOpportunities.push("local business schema");
  if (wordCount < 300) missingOpportunities.push("service-area content");

  const keywords: KeywordReport = {
    fromTitle,
    fromDescription,
    fromH1,
    fromBody,
    missingOpportunities,
  };

  const extraFindings: AuditFinding[] = [];
  if (!title) {
    extraFindings.push({
      id: "html-title",
      title: "Document does not have a title",
      description: "Page title is required for search engine rankings.",
      category: "html",
      severity: "critical",
    });
  }
  if (!hasViewport) {
    extraFindings.push({
      id: "html-viewport",
      title: "Missing viewport meta tag",
      description: "Mobile users will have a poor experience without a viewport.",
      category: "html",
      severity: "warning",
    });
  }

  return { htmlMeta, keywords, extraFindings };
}

export async function runSiteAudit(params: {
  url: string;
  placeId?: string;
  keyword?: string;
  businessName?: string;
  strategy?: "mobile" | "desktop";
}): Promise<SiteAuditResult> {
  const url = normalizeUrl(params.url);
  const strategy = params.strategy ?? "mobile";

  const [pageSpeed, htmlAnalysis] = await Promise.all([
    runPageSpeed(url, strategy),
    analyzeHtml(url).catch((err) => {
      console.warn("HTML analysis failed:", err);
      return null;
    }),
  ]);

  if (pageSpeed.error?.message) {
    throw new Error(pageSpeed.error.message);
  }

  const scores = parseScores(pageSpeed);
  const metrics = parseMetrics(pageSpeed);
  const findings = [
    ...parseFindings(pageSpeed),
    ...(htmlAnalysis?.extraFindings ?? []),
  ];

  const htmlMeta = htmlAnalysis?.htmlMeta ?? {
    title: null,
    description: null,
    h1: [],
    h2Count: 0,
    hasViewport: false,
    hasCanonical: false,
    hasRobotsMeta: false,
    hasStructuredData: false,
    hasOgTags: false,
    imageCount: 0,
    linkCount: 0,
    wordCount: 0,
    textToHtmlRatio: 0,
    ssrLikely: false,
    ssrNote: "Could not analyze HTML content",
  };

  const keywords = htmlAnalysis?.keywords ?? {
    fromTitle: [],
    fromDescription: [],
    fromH1: [],
    fromBody: [],
    missingOpportunities: ["Could not extract keywords"],
  };

  let localRank = null;
  if (params.placeId && params.keyword) {
    try {
      localRank = await getLocalSearchRank(params.placeId, params.keyword);
    } catch {
      // optional
    }
  }

  const insights = buildSiteAuditInsights({
    businessName: params.businessName ?? "Business",
    url,
    scores,
    htmlMeta,
    keywords,
    localRank,
  });

  return {
    url,
    scannedAt: new Date().toISOString(),
    strategy,
    scores,
    metrics,
    findings,
    htmlMeta,
    keywords,
    localRank,
    insights,
  };
}
