export interface AuditScoreCard {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
}

export interface AuditMetric {
  id: string;
  label: string;
  value: string;
  score?: number | null;
}

export interface AuditFinding {
  id: string;
  title: string;
  description: string;
  category: "performance" | "accessibility" | "seo" | "best-practices" | "html";
  severity: "critical" | "warning" | "info";
}

export interface HtmlMetaReport {
  title: string | null;
  description: string | null;
  h1: string[];
  h2Count: number;
  hasViewport: boolean;
  hasCanonical: boolean;
  hasRobotsMeta: boolean;
  hasStructuredData: boolean;
  hasOgTags: boolean;
  imageCount: number;
  linkCount: number;
  wordCount: number;
  textToHtmlRatio: number;
  ssrLikely: boolean;
  ssrNote: string;
}

export interface KeywordReport {
  fromTitle: string[];
  fromDescription: string[];
  fromH1: string[];
  fromBody: string[];
  missingOpportunities: string[];
}

export interface LocalSearchRank {
  keyword: string;
  rank: number;
  rankLabel: string;
}

export interface SiteAuditInsights {
  grade: string;
  gradeLabel: string;
  gradeColor: string;
  overallScore: number;
  issues: string[];
  recommendations: string[];
  pitch: string;
}

export interface TechnicalSeoSsl {
  secure: boolean;
  finalProtocol: string;
  note: string;
}

export interface TechnicalSeoRobots {
  found: boolean;
  url: string;
  allowsGooglebot: boolean | null;
  allowsAiBots: boolean | null;
  hasSitemapDirective: boolean;
  sitemapUrls?: string[];
  issues: string[];
}

export interface TechnicalSeoSitemap {
  found: boolean;
  url: string | null;
  urlCount: number;
  sampleUrls: string[];
}

export interface HeadlessRenderReport {
  enabled: boolean;
  success: boolean;
  error?: string;
  rawWordCount: number;
  renderedWordCount: number;
  contentGainPercent: number;
  renderTimeMs: number;
  renderedTitle: string | null;
  renderedH1: string[];
  verdict: "ssr_confirmed" | "csr_confirmed" | "hybrid_confirmed" | "inconclusive";
  summary: string;
}

export interface RenderingReport {
  mode: "ssr" | "csr" | "hybrid" | "unknown";
  chromeWordCount: number;
  googlebotWordCount: number;
  aiBotWordCount: number;
  scriptCount: number;
  botContentRatio: number;
  aiContentRatio: number;
  confidence: number;
  signals: {
    id: string;
    label: string;
    value: string;
    impact: "positive" | "negative" | "neutral";
  }[];
  summary: string;
  headless?: HeadlessRenderReport | null;
}

export interface BotCompatibilityReport {
  googlebotAccessible: boolean;
  aiCrawlerAccessible: boolean;
  googlebotBlockedByRobots: boolean;
  aiBlockedByRobots: boolean;
  notes: string[];
}

export interface CrawledPageSummary {
  url: string;
  status: number;
  title: string | null;
  wordCount: number;
  hasH1: boolean;
  issue: string | null;
  category: "healthy" | "broken" | "haveIssues" | "redirect" | "blocked";
  titleTooLong?: boolean;
}

export interface CrawlBreakdown {
  total: number;
  healthy: number;
  broken: number;
  haveIssues: number;
  redirects: number;
  blocked: number;
}

export interface AiBotStatus {
  id: string;
  name: string;
  status: "ok" | "blocked" | "limited";
  blockedByRobots: boolean;
  contentRatio: number;
  message: string;
}

export interface AuditIssueRow {
  id: string;
  title: string;
  pagesAffected: number;
  severity: "error" | "warning" | "info";
  howToFix: string;
  tag?: "AI Search";
}

export interface ThematicReport {
  id: string;
  title: string;
  score: number | null;
  status: "good" | "warning" | "error" | "na" | "info";
  note?: string;
}

export interface AuditDashboard {
  siteHealth: number;
  siteHealthLabel: string;
  benchmarkHealth: number;
  aiSearchHealth: number;
  aiSearchHealthLabel: string;
  crawlBreakdown: CrawlBreakdown;
  aiBots: AiBotStatus[];
  issueSummary: { errors: number; warnings: number };
  issueTable: AuditIssueRow[];
  thematicReports: ThematicReport[];
  llmsTxtFound: boolean;
}

export interface TechnicalSeoReport {
  ssl: TechnicalSeoSsl;
  robotsTxt: TechnicalSeoRobots;
  sitemap: TechnicalSeoSitemap;
  rendering: RenderingReport;
  botCompatibility: BotCompatibilityReport;
  crawledPages: CrawledPageSummary[];
  crawlBreakdown: CrawlBreakdown;
  aiBots: AiBotStatus[];
  aiSearchHealth: number;
  llmsTxt: { found: boolean; url: string };
  semanticHtmlScore: number;
  issueInventory: AuditIssueRow[];
}

export interface SiteAuditResult {
  url: string;
  scannedAt: string;
  strategy: "mobile" | "desktop";
  scores: AuditScoreCard;
  metrics: AuditMetric[];
  findings: AuditFinding[];
  htmlMeta: HtmlMetaReport;
  keywords: KeywordReport;
  localRank: LocalSearchRank | null;
  insights: SiteAuditInsights;
  technicalSeo?: TechnicalSeoReport | null;
  dashboard?: AuditDashboard | null;
  /** Final URL used for HTML crawl (may differ after www/https fallback). */
  htmlFetchedUrl?: string | null;
  /** Set when live HTML could not be crawled; Lighthouse data may still be present. */
  htmlAnalysisWarning?: string | null;
}

export interface PublicSiteAuditLeadSnapshot {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  email?: string | null;
  searchCategory?: string | null;
}

export interface PublicSiteAuditReport {
  lead: PublicSiteAuditLeadSnapshot;
  result: SiteAuditResult;
  createdAt: string;
}

export interface SiteAuditScanResponse extends SiteAuditResult {
  shareToken: string;
  shareUrl: string;
}
