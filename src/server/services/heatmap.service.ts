import { getGoogleMapsApiKey } from "@/server/config/env";
import { buildHeatmapInsights } from "@/lib/utils/heatmap-insights";
import type {
  HeatmapBusinessInfo,
  HeatmapCell,
  HeatmapCompetitor,
  HeatmapScanResult,
  HeatmapSummary,
} from "@/lib/types/heatmap";

const DEFAULT_GRID_SIZE = 7;
const DEFAULT_SPACING_KM = 1.2;
const SEARCH_RADIUS_METERS = 5000;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 350;
const NOT_RANKED = 21;

interface PlaceGeometryResponse {
  status: string;
  result?: {
    name?: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    website?: string;
    business_status?: string;
    geometry?: { location?: { lat: number; lng: number } };
    rating?: number;
    user_ratings_total?: number;
  };
  error_message?: string;
}

interface TextSearchResult {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
}

interface TextSearchResponse {
  status: string;
  results?: TextSearchResult[];
  error_message?: string;
}

interface LocationSearchResult {
  rank: number;
  competitors: HeatmapCompetitor[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function estimateZoom(gridSize: number, spacingKm: number): number {
  const spanKm = gridSize * spacingKm;
  if (spanKm <= 6) return 13;
  if (spanKm <= 10) return 12;
  if (spanKm <= 16) return 11;
  return 10;
}

export function buildStaticMapPath(
  lat: number,
  lng: number,
  gridSize: number,
  spacingKm: number
): string {
  const zoom = estimateZoom(gridSize, spacingKm);
  return `/api/heatmap/map?lat=${lat}&lng=${lng}&zoom=${zoom}`;
}

export async function getPlaceBusinessInfo(
  placeId: string
): Promise<HeatmapBusinessInfo> {
  const apiKey = getGoogleMapsApiKey();
  const fields = [
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "business_status",
    "geometry",
    "rating",
    "user_ratings_total",
  ].join(",");
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${apiKey}`;

  const response = await fetch(url);
  const data = (await response.json()) as PlaceGeometryResponse;

  if (data.status !== "OK" || !data.result?.geometry?.location) {
    throw new Error(
      `Could not load business location: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`
    );
  }

  const { lat, lng } = data.result.geometry.location;

  return {
    placeId,
    name: data.result.name ?? "Business",
    address: data.result.formatted_address ?? "",
    phone: data.result.formatted_phone_number ?? null,
    website: data.result.website ?? null,
    businessStatus: data.result.business_status ?? null,
    rating: data.result.rating ?? null,
    userRatingsTotal: data.result.user_ratings_total ?? null,
    lat,
    lng,
  };
}

function generateGrid(
  centerLat: number,
  centerLng: number,
  gridSize: number,
  spacingKm: number
): Omit<HeatmapCell, "rank">[] {
  const half = Math.floor(gridSize / 2);
  const latStep = spacingKm / 111.32;
  const lngStep = spacingKm / (111.32 * Math.cos((centerLat * Math.PI) / 180));
  const cells: Omit<HeatmapCell, "rank">[] = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const rowOffset = row - half;
      const colOffset = col - half;
      cells.push({
        row,
        col,
        lat: centerLat + rowOffset * latStep,
        lng: centerLng + colOffset * lngStep,
        isCenter: rowOffset === 0 && colOffset === 0,
      });
    }
  }

  return cells;
}

async function fetchTextSearch(
  keyword: string,
  lat: number,
  lng: number
): Promise<TextSearchResponse> {
  const apiKey = getGoogleMapsApiKey();
  const params = new URLSearchParams({
    query: keyword,
    location: `${lat},${lng}`,
    radius: String(SEARCH_RADIUS_METERS),
    key: apiKey,
  });

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
  const response = await fetch(url);
  return response.json();
}

async function searchAtLocation(
  keyword: string,
  lat: number,
  lng: number,
  targetPlaceId: string,
  targetName: string
): Promise<LocationSearchResult> {
  const data = await fetchTextSearch(keyword, lat, lng);

  if (data.status !== "OK" || !data.results?.length) {
    return { rank: NOT_RANKED, competitors: [] };
  }

  const normalizedTarget = normalizeName(targetName);
  let rank = NOT_RANKED;

  for (let i = 0; i < data.results.length; i++) {
    const place = data.results[i];
    if (
      place.place_id === targetPlaceId ||
      normalizeName(place.name) === normalizedTarget
    ) {
      rank = i + 1;
      break;
    }
  }

  const competitors: HeatmapCompetitor[] = data.results
    .slice(0, 8)
    .map((place, index) => ({
      placeId: place.place_id,
      name: place.name,
      rank: index + 1,
      rating: place.rating ?? null,
      userRatingsTotal: place.user_ratings_total ?? null,
      isTarget:
        place.place_id === targetPlaceId ||
        normalizeName(place.name) === normalizedTarget,
    }));

  return { rank, competitors };
}

async function findRankAtLocation(
  keyword: string,
  lat: number,
  lng: number,
  targetPlaceId: string,
  targetName: string
): Promise<number> {
  const { rank } = await searchAtLocation(
    keyword,
    lat,
    lng,
    targetPlaceId,
    targetName
  );
  return rank;
}

function buildSummary(cells: HeatmapCell[]): HeatmapSummary {
  const total = cells.length || 1;
  const ranks = cells.map((cell) => cell.rank);
  const avgRank =
    Math.round((ranks.reduce((sum, rank) => sum + rank, 0) / total) * 10) / 10;
  const top3Count = ranks.filter((rank) => rank <= 3).length;
  const page1Count = ranks.filter((rank) => rank <= 10).length;
  const notRankingCount = ranks.filter((rank) => rank >= NOT_RANKED).length;

  return {
    avgRank,
    top3Count,
    top3Percent: Math.round((top3Count / total) * 100),
    page1Count,
    page1Percent: Math.round((page1Count / total) * 100),
    notRankingCount,
    notRankingPercent: Math.round((notRankingCount / total) * 100),
  };
}

async function scanGridCells(
  gridPoints: Omit<HeatmapCell, "rank">[],
  keyword: string,
  targetPlaceId: string,
  targetName: string
): Promise<{ cells: HeatmapCell[]; competitors: HeatmapCompetitor[] }> {
  const results: HeatmapCell[] = [];
  let competitors: HeatmapCompetitor[] = [];

  for (let i = 0; i < gridPoints.length; i += BATCH_SIZE) {
    const batch = gridPoints.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (point) => {
        if (point.isCenter) {
          const centerSearch = await searchAtLocation(
            keyword,
            point.lat,
            point.lng,
            targetPlaceId,
            targetName
          );
          competitors = centerSearch.competitors;
          return { ...point, rank: centerSearch.rank };
        }

        const rank = await findRankAtLocation(
          keyword,
          point.lat,
          point.lng,
          targetPlaceId,
          targetName
        );
        return { ...point, rank };
      })
    );
    results.push(...batchResults);

    if (i + BATCH_SIZE < gridPoints.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return { cells: results, competitors };
}

export async function scanHeatmap(params: {
  placeId: string;
  keyword: string;
  gridSize?: number;
  spacingKm?: number;
  hasWebsite?: boolean;
}): Promise<HeatmapScanResult> {
  const gridSize = params.gridSize ?? DEFAULT_GRID_SIZE;
  const spacingKm = params.spacingKm ?? DEFAULT_SPACING_KM;
  const keyword = params.keyword.trim();

  if (!keyword) {
    throw new Error("Keyword is required");
  }

  const business = await getPlaceBusinessInfo(params.placeId);
  const gridPoints = generateGrid(
    business.lat,
    business.lng,
    gridSize,
    spacingKm
  );
  const { cells, competitors } = await scanGridCells(
    gridPoints,
    keyword,
    business.placeId,
    business.name
  );

  const summary = buildSummary(cells);
  const centerCell = cells.find((cell) => cell.isCenter);
  const businessRank = centerCell?.rank ?? NOT_RANKED;
  const hasWebsite =
    Boolean(params.hasWebsite) ||
    Boolean(business.website && business.website.length > 0);

  const insights = buildHeatmapInsights({
    business,
    keyword,
    summary,
    businessRank,
    competitors,
    hasWebsite,
  });

  return {
    business,
    keyword,
    gridSize,
    spacingKm,
    cells,
    summary,
    competitors,
    insights,
    mapUrl: buildStaticMapPath(business.lat, business.lng, gridSize, spacingKm),
  };
}

export async function getLocalSearchRank(
  placeId: string,
  keyword: string
): Promise<{ keyword: string; rank: number; rankLabel: string } | null> {
  const kw = keyword.trim();
  if (!kw) return null;

  const business = await getPlaceBusinessInfo(placeId);
  const { rank } = await searchAtLocation(
    kw,
    business.lat,
    business.lng,
    business.placeId,
    business.name
  );

  return {
    keyword: kw,
    rank,
    rankLabel: rank >= NOT_RANKED ? "20+" : String(rank),
  };
}

export async function fetchStaticMapImage(
  lat: number,
  lng: number,
  zoom: number
): Promise<ArrayBuffer> {
  const apiKey = getGoogleMapsApiKey();
  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=640x640&scale=2&maptype=roadmap&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load map image (${response.status})`);
  }

  return response.arrayBuffer();
}
