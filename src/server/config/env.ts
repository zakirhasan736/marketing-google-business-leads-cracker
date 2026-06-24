export function getGoogleMapsApiKey(): string {
  const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
  if (!apiKey || apiKey === "YOUR_API_KEY") {
    throw new Error("GOOGLE_MAPS_PLATFORM_KEY is not configured");
  }
  return apiKey;
}

export function isGoogleMapsConfigured(): boolean {
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY;
  return Boolean(key && key !== "YOUR_API_KEY");
}

export function getDatabasePath(): string {
  return process.env.DATABASE_PATH ?? "data/leads.db";
}

/** Target results per category search (Google Text Search max 60 = 3 pages × 20). */
export function getMaxResultsPerCategory(): number {
  const raw = process.env.PLACES_MAX_RESULTS_PER_CATEGORY;
  const parsed = raw ? parseInt(raw, 10) : 60;
  if (Number.isNaN(parsed)) return 60;
  return Math.min(Math.max(parsed, 1), 60);
}

/** Public site URL for client-facing share links (heatmap, site audit). */
export function getPublicAppOrigin(request: Request): string {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

export function buildShareUrl(request: Request, path: string): string {
  const base = getPublicAppOrigin(request);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
