import type { Lead } from "@/lib/types";

export const LEADS_PAGE_SIZE = 50;

export interface ParsedSearchLocation {
  zip: string;
  state: string;
  country: string;
}

export interface LeadTableFilters {
  category: string;
  country: string;
  state: string;
  zip: string;
  status: string;
}

export const DEFAULT_LEAD_FILTERS: LeadTableFilters = {
  category: "All",
  country: "All",
  state: "All",
  zip: "All",
  status: "All",
};

export function parseSearchLocation(
  location?: string | null
): ParsedSearchLocation {
  if (!location) return { zip: "", state: "", country: "" };

  const parts = location.split(",").map((s) => s.trim());
  if (parts.length >= 3) {
    return {
      zip: parts[0] ?? "",
      state: parts[1] ?? "",
      country: parts.slice(2).join(", "),
    };
  }

  return {
    zip: parts[0] ?? "",
    state: parts[1] ?? "",
    country: parts[2] ?? "",
  };
}

export function getLeadLocationParts(lead: Lead): ParsedSearchLocation {
  return parseSearchLocation(lead.searchLocation);
}

export function filterLeads(
  leads: Lead[],
  filters: LeadTableFilters
): Lead[] {
  return leads.filter((lead) => {
    const loc = getLeadLocationParts(lead);

    if (
      filters.status !== "All" &&
      (lead.status || "New") !== filters.status
    ) {
      return false;
    }

    if (
      filters.category !== "All" &&
      (lead.searchCategory ?? "") !== filters.category
    ) {
      return false;
    }

    if (filters.country !== "All" && loc.country !== filters.country) {
      return false;
    }

    if (filters.state !== "All" && loc.state !== filters.state) {
      return false;
    }

    if (filters.zip !== "All" && loc.zip !== filters.zip) {
      return false;
    }

    return true;
  });
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function buildFilterOptions(leads: Lead[]) {
  const categories: string[] = [];
  const countries: string[] = [];
  const states: string[] = [];
  const zips: string[] = [];

  for (const lead of leads) {
    if (lead.searchCategory) categories.push(lead.searchCategory);
    const loc = getLeadLocationParts(lead);
    if (loc.country) countries.push(loc.country);
    if (loc.state) states.push(loc.state);
    if (loc.zip) zips.push(loc.zip);
  }

  return {
    categories: uniqueSorted(categories),
    countries: uniqueSorted(countries),
    states: uniqueSorted(states),
    zips: uniqueSorted(zips),
  };
}

export function getStatesForCountry(
  leads: Lead[],
  country: string
): string[] {
  const states = leads
    .filter((lead) => {
      if (country === "All") return true;
      return getLeadLocationParts(lead).country === country;
    })
    .map((lead) => getLeadLocationParts(lead).state);

  return uniqueSorted(states);
}

export function getZipsForFilters(
  leads: Lead[],
  country: string,
  state: string
): string[] {
  const zips = leads
    .filter((lead) => {
      const loc = getLeadLocationParts(lead);
      if (country !== "All" && loc.country !== country) return false;
      if (state !== "All" && loc.state !== state) return false;
      return true;
    })
    .map((lead) => getLeadLocationParts(lead).zip);

  return uniqueSorted(zips);
}

export function paginateLeads<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    items: items.slice(startIndex, endIndex),
    page: safePage,
    totalPages,
    totalItems,
    startIndex: totalItems === 0 ? 0 : startIndex + 1,
    endIndex,
  };
}
