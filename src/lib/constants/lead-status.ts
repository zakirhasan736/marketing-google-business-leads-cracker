export const LEAD_STATUSES = [
  "New",
  "Collected",
  "No Email",
  "Contacted",
  "Interested",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** One lead per request — safest for large lists behind gateway timeouts. */
export const EMAIL_SCAN_BATCH_SIZE = 1;
