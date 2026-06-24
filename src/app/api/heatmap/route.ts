import { NextResponse } from "next/server";
import { isGoogleMapsConfigured } from "@/server/config/env";
import { saveHeatmapReport } from "@/server/repositories/heatmap-reports.repository";
import { scanHeatmap } from "@/server/services/heatmap.service";
import type { PublicHeatmapLeadSnapshot, PublicHeatmapReport } from "@/lib/types/heatmap";

export async function POST(request: Request) {
  if (!isGoogleMapsConfigured()) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { placeId, keyword, gridSize, spacingKm, lead } = body;

    if (!placeId || !keyword) {
      return NextResponse.json(
        { error: "placeId and keyword are required" },
        { status: 400 }
      );
    }

    const result = await scanHeatmap({
      placeId,
      keyword: String(keyword),
      gridSize: gridSize ? Number(gridSize) : undefined,
      spacingKm: spacingKm ? Number(spacingKm) : undefined,
      hasWebsite:
        typeof body.hasWebsite === "boolean" ? body.hasWebsite : undefined,
    });

    const origin = new URL(request.url).origin;
    let shareToken = "";
    let shareUrl = "";

    if (lead?.name && lead?.address) {
      const snapshot = lead as PublicHeatmapLeadSnapshot;
      const report: PublicHeatmapReport = {
        lead: {
          placeId: snapshot.placeId ?? placeId,
          name: snapshot.name,
          address: snapshot.address,
          phone: snapshot.phone ?? "N/A",
          website: snapshot.website ?? "N/A",
          email: snapshot.email ?? null,
          searchCategory: snapshot.searchCategory ?? null,
        },
        result,
        createdAt: new Date().toISOString(),
      };
      shareToken = saveHeatmapReport(report);
      shareUrl = `${origin}/report/${shareToken}`;
    }

    return NextResponse.json({ ...result, shareToken, shareUrl });
  } catch (error) {
    console.error("Heatmap scan failed:", error);
    const message =
      error instanceof Error ? error.message : "Heatmap scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
