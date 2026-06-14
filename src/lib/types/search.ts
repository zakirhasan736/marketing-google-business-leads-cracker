export interface SearchRequest {
  category: string;
  location: string;
  country?: string;
  state?: string;
  zip?: string;
}

export interface RecentSearch {
  country: string;
  state: string;
  zip: string;
  category?: string;
  date: string;
}

export const ALL_CATEGORIES_LABEL = "All categories";
