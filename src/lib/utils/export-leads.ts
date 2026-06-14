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

export function leadsMissingEmail(leads: Lead[]): Lead[] {
  return leads.filter((lead) => !lead.email);
}
