import { NextResponse } from "next/server";
import {
  deleteAllLeads,
  deleteLeads,
  getAllLeads,
} from "@/server/repositories/leads.repository";

export async function GET() {
  const leads = getAllLeads();
  return NextResponse.json({ leads });
}

export async function DELETE(request: Request) {
  const body = await request.json();

  if (body.deleteAll === true) {
    const deleted = deleteAllLeads();
    return NextResponse.json({ deleted, leads: [] });
  }

  const placeIds: string[] = body.placeIds ?? [];

  if (!Array.isArray(placeIds) || placeIds.length === 0) {
    return NextResponse.json(
      { error: "placeIds array is required, or set deleteAll: true" },
      { status: 400 }
    );
  }

  const deleted = deleteLeads(placeIds);
  return NextResponse.json({ deleted, leads: getAllLeads() });
}