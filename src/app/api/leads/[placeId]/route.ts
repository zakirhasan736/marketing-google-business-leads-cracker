import { NextResponse } from "next/server";
import type { LeadStatus } from "@/lib/types";
import {
  deleteLead,
  getLeadByPlaceId,
  updateLead,
} from "@/server/repositories/leads.repository";

interface RouteParams {
  params: Promise<{ placeId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { placeId } = await params;
  const lead = getLeadByPlaceId(placeId);

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { placeId } = await params;
  const body = await request.json();

  const updates: Partial<{ status: LeadStatus; note: string; email: string }> =
    {};

  if (body.status !== undefined) updates.status = body.status;
  if (body.note !== undefined) updates.note = body.note;
  if (body.email !== undefined) updates.email = body.email;

  const lead = updateLead(placeId, updates);

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { placeId } = await params;
  const deleted = deleteLead(placeId);

  if (!deleted) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
