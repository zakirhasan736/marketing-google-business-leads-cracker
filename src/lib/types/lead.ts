import type { LeadStatus } from "@/lib/constants/lead-status";

export type { LeadStatus } from "@/lib/constants/lead-status";
export { LEAD_STATUSES } from "@/lib/constants/lead-status";

export interface Lead {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  email?: string | null;
  status: LeadStatus;
  note?: string | null;
  searchCategory?: string | null;
  searchLocation?: string | null;
  contactPageUrl?: string | null;
  mapsUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessResult {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsUrl?: string | null;
}
