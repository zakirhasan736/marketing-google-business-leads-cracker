export const LEAD_STATUSES = [
  "New",
  "Collected",
  "No Email",
  "Contacted",
  "Interested",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const EMAIL_SCAN_BATCH_SIZE = 50;
