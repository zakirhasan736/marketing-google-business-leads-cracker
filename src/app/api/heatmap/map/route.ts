import { NextResponse } from "next/server";
import { isGoogleMapsConfigured } from "@/server/config/env";
import { fetchStaticMapImage } from "@/server/services/heatmap.service";

export async function GET(request: Request) {
  if (!isGoogleMapsConfigured()) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const zoom = Number(searchParams.get("zoom") ?? "12");

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  try {
    const image = await fetchStaticMapImage(lat, lng, zoom);
    return new NextResponse(image, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Static map fetch failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load map";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
