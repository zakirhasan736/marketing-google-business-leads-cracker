export interface HeatmapCell {
  row: number;
  col: number;
  lat: number;
  lng: number;
  rank: number;
  isCenter: boolean;
}

export interface HeatmapBusinessInfo {
  placeId: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  businessStatus: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  lat: number;
  lng: number;
}

export interface HeatmapSummary {
  avgRank: number;
  top3Count: number;
  top3Percent: number;
  page1Count: number;
  page1Percent: number;
  notRankingCount: number;
  notRankingPercent: number;
}

export interface HeatmapCompetitor {
  placeId: string;
  name: string;
  rank: number;
  rating: number | null;
  userRatingsTotal: number | null;
  isTarget: boolean;
}

export interface HeatmapInsights {
  grade: string;
  gradeLabel: string;
  gradeColor: string;
  businessRank: number;
  businessRankLabel: string;
  visibilityScore: number;
  issues: string[];
  opportunities: string[];
  pitch: string;
}

export interface HeatmapScanResult {
  business: HeatmapBusinessInfo;
  keyword: string;
  gridSize: number;
  spacingKm: number;
  cells: HeatmapCell[];
  summary: HeatmapSummary;
  competitors: HeatmapCompetitor[];
  insights: HeatmapInsights;
  mapUrl: string;
}

export interface PublicHeatmapLeadSnapshot {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  email?: string | null;
  searchCategory?: string | null;
}

export interface PublicHeatmapReport {
  lead: PublicHeatmapLeadSnapshot;
  result: HeatmapScanResult;
  createdAt: string;
}

export interface HeatmapScanResponse extends HeatmapScanResult {
  shareToken: string;
  shareUrl: string;
}
