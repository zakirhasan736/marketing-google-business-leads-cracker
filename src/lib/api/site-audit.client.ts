import type { Lead } from "@/lib/types";
import type { SiteAuditScanResponse } from "@/lib/types/site-audit";

export async function runSiteAuditApi(params: {
  url: string;
  lead: Lead;
  strategy?: "mobile" | "desktop";
  headlessRender?: boolean;
}): Promise<SiteAuditScanResponse> {
  const response = await fetch("/api/site-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: params.url,
      strategy: params.strategy ?? "mobile",
      headlessRender: Boolean(params.headlessRender),
      placeId: params.lead.placeId,
      keyword: params.lead.searchCategory
        ? `${params.lead.searchCategory} near me`
        : undefined,
      lead: {
        placeId: params.lead.placeId,
        name: params.lead.name,
        address: params.lead.address,
        phone: params.lead.phone,
        website: params.lead.website,
        email: params.lead.email,
        searchCategory: params.lead.searchCategory,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Site audit failed");
  }

  return data as SiteAuditScanResponse;
}

export async function fetchSharedSiteAudit(token: string) {
  const response = await fetch(
    `/api/site-audit/report/${encodeURIComponent(token)}`
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Report not found");
  }
  return data.report;
}
