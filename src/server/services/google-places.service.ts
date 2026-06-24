import {
  getGoogleMapsApiKey,
  getMaxResultsPerCategory,
} from "@/server/config/env";
import type { BusinessResult } from "@/lib/types";

/** Google Text Search returns 20 results per page, max 3 pages. */
const PLACES_PAGE_SIZE = 20;
const PLACES_MAX_PAGES = 3;
const PAGE_TOKEN_INITIAL_DELAY_MS = 2500;
const PAGE_TOKEN_RETRY_DELAY_MS = 2000;
const PAGE_TOKEN_MAX_ATTEMPTS = 6;

interface TextSearchPlace {
  place_id: string;
  name: string;
  formatted_address: string;
}

interface TextSearchResponse {
  status: string;
  results?: TextSearchPlace[];
  next_page_token?: string;
  error_message?: string;
}

async function fetchTextSearchPage(
  query: string,
  pageToken?: string
): Promise<TextSearchResponse> {
  const apiKey = getGoogleMapsApiKey();
  const params = new URLSearchParams({ key: apiKey });

  // Paginated requests must use ONLY pagetoken + key (no query param).
  if (pageToken) {
    params.set("pagetoken", pageToken);
  } else {
    params.set("query", query);
  }

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
  const response = await fetch(url);
  return response.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextSearchPageWithRetry(
  query: string,
  pageToken?: string
): Promise<TextSearchResponse> {
  const maxAttempts = pageToken ? PAGE_TOKEN_MAX_ATTEMPTS : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (pageToken && attempt > 0) {
      await delay(PAGE_TOKEN_RETRY_DELAY_MS);
    }

    const searchData = await fetchTextSearchPage(query, pageToken);

    if (searchData.status === "OK" || searchData.status === "ZERO_RESULTS") {
      return searchData;
    }

    // Page tokens can be briefly invalid right after the first response.
    if (pageToken && searchData.status === "INVALID_REQUEST") {
      continue;
    }

    return searchData;
  }

  return { status: "INVALID_REQUEST" };
}

async function collectSearchResults(
  query: string,
  maxResults: number
): Promise<TextSearchPlace[]> {
  const collected: TextSearchPlace[] = [];
  const seenIds = new Set<string>();
  let pageToken: string | undefined;
  let pagesFetched = 0;
  const maxPages = Math.min(
    PLACES_MAX_PAGES,
    Math.ceil(maxResults / PLACES_PAGE_SIZE)
  );

  while (collected.length < maxResults && pagesFetched < maxPages) {
    if (pageToken) {
      // Google requires a short delay before next_page_token becomes valid.
      await delay(PAGE_TOKEN_INITIAL_DELAY_MS);
    }

    const searchData = await fetchTextSearchPageWithRetry(query, pageToken);
    pagesFetched++;

    if (searchData.status === "ZERO_RESULTS") {
      break;
    }

    if (searchData.status !== "OK") {
      // Keep partial results if pagination fails after page 1
      if (collected.length > 0) {
        console.warn(
          `Google Places pagination stopped on page ${pagesFetched}: ${searchData.status}${searchData.error_message ? ` — ${searchData.error_message}` : ""}`
        );
        break;
      }
      throw new Error(
        `Google API Search Error: ${searchData.status}${searchData.error_message ? ` — ${searchData.error_message}` : ""}`
      );
    }

    for (const place of searchData.results ?? []) {
      if (seenIds.has(place.place_id)) continue;
      seenIds.add(place.place_id);
      collected.push(place);
      if (collected.length >= maxResults) break;
    }

    if (!searchData.next_page_token || collected.length >= maxResults) {
      break;
    }

    pageToken = searchData.next_page_token;
  }

  return collected.slice(0, maxResults);
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<BusinessResult | null> {
  const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,url&key=${apiKey}`;

  try {
    const detailResponse = await fetch(detailUrl);
    const detailData = await detailResponse.json();

    if (detailData.status !== "OK" || !detailData.result) {
      return null;
    }

    return {
      placeId,
      name: detailData.result.name,
      address: detailData.result.formatted_address,
      phone: detailData.result.formatted_phone_number || "N/A",
      website: detailData.result.website || "N/A",
      mapsUrl: detailData.result.url ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchDetailsInBatches(
  places: TextSearchPlace[],
  batchSize = 10
): Promise<BusinessResult[]> {
  const apiKey = getGoogleMapsApiKey();
  const results: BusinessResult[] = [];

  for (let i = 0; i < places.length; i += batchSize) {
    const batch = places.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (biz) => {
        const detailed = await fetchPlaceDetails(biz.place_id, apiKey);
        if (detailed) return detailed;

        return {
          placeId: biz.place_id,
          name: biz.name,
          address: biz.formatted_address,
          phone: "N/A",
          website: "N/A",
          mapsUrl: null,
        };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

export async function searchBusinesses(
  category: string,
  location: string
): Promise<BusinessResult[]> {
  const maxResults = getMaxResultsPerCategory();
  const query = `${category} in ${location}`;

  const places = await collectSearchResults(query, maxResults);

  if (places.length === 0) {
    return [];
  }

  return fetchDetailsInBatches(places);
}
