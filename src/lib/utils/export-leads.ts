import type { Lead } from "@/lib/types";
import { getLeadLocationParts } from "@/lib/utils/lead-filters";
import { getLeadMapsUrl } from "@/lib/utils/google-maps";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function leadsToCsv(leads: Lead[]): string {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Website",
    "Category",
    "Zip",
    "State",
    "Country",
    "Address",
    "Map Link",
    "Status",
    "Notes",
    "Heatmap Link",
    "Heatmap Keyword",
    "Site Audit Link",
    "Contact Page",
  ];

  const rows = leads.map((lead) => {
    const loc = getLeadLocationParts(lead);
    return [
      lead.name,
      lead.email || "",
      lead.phone,
      lead.website,
      lead.searchCategory || "",
      loc.zip,
      loc.state,
      loc.country,
      lead.address,
      getLeadMapsUrl(lead),
      lead.status || "New",
      lead.note || "",
      lead.heatmapShareUrl || "",
      lead.heatmapKeyword || "",
      lead.siteAuditShareUrl || "",
      lead.contactPageUrl || "",
    ]
      .map((v) => escapeCsv(String(v)))
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Leads that still need a first-time email scan (excludes already-scanned "No Email"). */
export function leadsNeedingEmailScan(leads: Lead[]): Lead[] {
  return leads.filter((lead) => !lead.email && lead.status !== "No Email");
}

/** @deprecated Use leadsNeedingEmailScan — kept for export naming compatibility */
export function leadsMissingEmail(leads: Lead[]): Lead[] {
  return leadsNeedingEmailScan(leads);
}

/** Leads previously marked No Email that can be re-scraped (optional, slower). */
export function leadsToRescanEmail(leads: Lead[]): Lead[] {
  return leads.filter(
    (lead) =>
      !lead.email &&
      lead.status === "No Email" &&
      Boolean(lead.website) &&
      lead.website !== "N/A"
  );
}

export function mergeLeadUpdates(current: Lead[], updated: Lead[]): Lead[] {
  if (updated.length === 0) return current;
  const byId = new Map(updated.map((lead) => [lead.placeId, lead]));
  return current.map((lead) => byId.get(lead.placeId) ?? lead);
}
