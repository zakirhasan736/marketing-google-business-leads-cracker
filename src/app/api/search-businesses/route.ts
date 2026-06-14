import { NextResponse } from "next/server";
import { isGoogleMapsConfigured } from "@/server/config/env";
import {
  getAllLeads,
  getExistingPlaceIds,
  upsertLead,
} from "@/server/repositories/leads.repository";
import { searchBusinesses } from "@/server/services/google-places.service";

export async function POST(request: Request) {
  if (!isGoogleMapsConfigured()) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { category, location, country, state, zip } = body;

  if (!category || !location) {
    return NextResponse.json(
      { error: "category and location are required" },
      { status: 400 }
    );
  }

  try {
    const results = await searchBusinesses(category, location);
    const existingIds = getExistingPlaceIds();
    const searchLocation = [zip, state, country].filter(Boolean).join(", ");

    let newCount = 0;

    for (const biz of results) {
      const isNew = !existingIds.has(biz.placeId);
      upsertLead({
        placeId: biz.placeId,
        name: biz.name,
        address: biz.address,
        phone: biz.phone,
        website: biz.website,
        mapsUrl: biz.mapsUrl,
        status: "New",
        searchCategory: category,
        searchLocation: searchLocation || location,
      });
      if (isNew) newCount++;
    }

    const leads = getAllLeads();

    return NextResponse.json({
      results,
      newCount,
      leads,
    });
  } catch (error) {
    console.error("Error fetching from Google Places:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch businesses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
