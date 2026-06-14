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

/** Target results per category search (Google Text Search max ~60 via pagination). */
export function getMaxResultsPerCategory(): number {
  const raw = process.env.PLACES_MAX_RESULTS_PER_CATEGORY;
  const parsed = raw ? parseInt(raw, 10) : 50;
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 60);
}
