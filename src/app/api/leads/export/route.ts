import { NextResponse } from "next/server";
import { getAllLeads, getLeadByPlaceId, updateLead } from "@/server/repositories/leads.repository";

export async function POST(request: Request) {
  const body = await request.json();
  const placeIds: string[] = body.placeIds ?? [];

  if (!Array.isArray(placeIds) || placeIds.length === 0) {
    return NextResponse.json(
      { error: "placeIds array is required" },
      { status: 400 }
    );
  }

  let markedCollected = 0;
  let markedNoEmail = 0;

  for (const placeId of placeIds) {
    const lead = getLeadByPlaceId(placeId);
    if (!lead) continue;

    if (lead.email) {
      updateLead(placeId, { status: "Collected" });
      markedCollected++;
    } else {
      updateLead(placeId, { status: "No Email" });
      markedNoEmail++;
    }
  }

  return NextResponse.json({
    markedCollected,
    markedNoEmail,
    leads: getAllLeads(),
  });
}
