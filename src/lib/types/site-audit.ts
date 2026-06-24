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
