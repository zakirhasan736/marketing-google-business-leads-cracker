import type { HeatmapScanResponse } from "@/lib/types/heatmap";
import type { Lead } from "@/lib/types";

export async function scanHeatmapApi(params: {
  placeId: string;
  keyword: string;
  gridSize?: number;
  hasWebsite?: boolean;
  lead?: Lead;
}): Promise<HeatmapScanResponse> {
  const response = await fetch("/api/heatmap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      placeId: params.placeId,
      keyword: params.keyword,
      gridSize: params.gridSize,
      hasWebsite: params.hasWebsite,
      lead: params.lead
        ? {
            placeId: params.lead.placeId,
            name: params.lead.name,
            address: params.lead.address,
            phone: params.lead.phone,
            website: params.lead.website,
            email: params.lead.email,
            searchCategory: params.lead.searchCategory,
          }
        : undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Heatmap scan failed");
  }

  return data as HeatmapScanResponse;
}

export async function fetchSharedReport(token: string) {
  const response = await fetch(`/api/heatmap/report/${encodeURIComponent(token)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Report not found");
  }
  return data.report;
}
