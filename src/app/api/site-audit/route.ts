import { NextResponse } from "next/server";
import { isGoogleMapsConfigured, buildShareUrl } from "@/server/config/env";
import { updateLead } from "@/server/repositories/leads.repository";
import { saveSiteAuditReport } from "@/server/repositories/site-audit-reports.repository";
import { runSiteAudit } from "@/server/services/site-audit.service";
import type {
  PublicSiteAuditLeadSnapshot,
  PublicSiteAuditReport,
} from "@/lib/types/site-audit";

/** Site audit can run PageSpeed + multi-page technical crawl (+ optional headless render). */
export const maxDuration = 180;

export async function POST(request: Request) {
  if (!isGoogleMapsConfigured()) {
    return NextResponse.json(
      { error: "Google API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { url, placeId, keyword, lead, strategy, headlessRender } = body;

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const snapshot = lead as PublicSiteAuditLeadSnapshot | undefined;
    const searchKeyword =
      keyword ||
      (snapshot?.searchCategory
        ? `${snapshot.searchCategory} near me`
        : undefined);

    const result = await runSiteAudit({
      url: String(url),
      placeId: placeId ?? snapshot?.placeId,
      keyword: searchKeyword,
      businessName: snapshot?.name,
      strategy:
        strategy === "desktop" || strategy === "mobile" ? strategy : undefined,
      headlessRender: Boolean(headlessRender),
    });

    let shareToken = "";
    let shareUrl = "";

    if (snapshot?.name) {
      const report: PublicSiteAuditReport = {
        lead: {
          placeId: snapshot.placeId ?? placeId ?? "",
          name: snapshot.name,
          address: snapshot.address ?? "",
          phone: snapshot.phone ?? "N/A",
          website: snapshot.website ?? url,
          email: snapshot.email ?? null,
          searchCategory: snapshot.searchCategory ?? null,
        },
        result,
        createdAt: new Date().toISOString(),
      };
      shareToken = saveSiteAuditReport(report);
      shareUrl = buildShareUrl(request, `/audit/${shareToken}`);
      const resolvedPlaceId = snapshot.placeId ?? placeId;
      if (resolvedPlaceId) {
        updateLead(resolvedPlaceId, { siteAuditShareUrl: shareUrl });
      }
    }

    return NextResponse.json({ ...result, shareToken, shareUrl });
  } catch (error) {
    console.error("Site audit failed:", error);
    const message =
      error instanceof Error ? error.message : "Site audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
