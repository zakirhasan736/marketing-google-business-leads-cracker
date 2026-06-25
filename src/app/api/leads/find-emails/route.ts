import { NextResponse } from "next/server";
import type { Lead } from "@/lib/types";
import {
  getLeadByPlaceId,
  updateLead,
} from "@/server/repositories/leads.repository";
import { discoverEmailFromWebsite } from "@/server/services/email-scraper.service";

/** Allow longer runs on Vercel / Node hosting (seconds). */
export const maxDuration = 60;

type ScanOutcome =
  | { type: "skipped" }
  | { type: "no_website"; placeId: string }
  | { type: "email"; placeId: string }
  | { type: "contact_form"; placeId: string }
  | { type: "no_email"; placeId: string };

async function scanSingleLead(lead: Lead): Promise<ScanOutcome> {
  if (lead.email) {
    return { type: "skipped" };
  }

  if (!lead.website || lead.website === "N/A") {
    updateLead(lead.placeId, { status: "No Email" });
    return { type: "no_website", placeId: lead.placeId };
  }

  const discovery = await discoverEmailFromWebsite(lead.website);

  if (discovery.email) {
    updateLead(lead.placeId, {
      email: discovery.email,
      status: "Collected",
      contactPageUrl: discovery.contactPageUrl,
    });
    return { type: "email", placeId: lead.placeId };
  }

  if (discovery.contactFormDetected && discovery.contactPageUrl) {
    updateLead(lead.placeId, {
      status: "No Email",
      contactPageUrl: discovery.contactPageUrl,
      note: lead.note || "Contact form only — no email found",
    });
    return { type: "contact_form", placeId: lead.placeId };
  }

  updateLead(lead.placeId, { status: "No Email" });
  return { type: "no_email", placeId: lead.placeId };
}

function resolveLeadsFromBody(body: {
  placeIds?: string[];
  leads?: Lead[];
}): Lead[] {
  if (Array.isArray(body.placeIds) && body.placeIds.length > 0) {
    return body.placeIds
      .map((placeId) => getLeadByPlaceId(placeId))
      .filter((lead): lead is Lead => lead !== null);
  }

  if (Array.isArray(body.leads) && body.leads.length > 0) {
    return body.leads;
  }

  return [];
}

export async function POST(request: Request) {
  const body = await request.json();
  const leads = resolveLeadsFromBody(body);

  if (leads.length === 0) {
    return NextResponse.json(
      { error: "placeIds or leads array is required" },
      { status: 400 }
    );
  }

  let emailsFound = 0;
  let contactFormsFound = 0;
  let markedNoEmail = 0;
  let skipped = 0;
  let processed = 0;
  const updatedPlaceIds = new Set<string>();

  for (const lead of leads) {
    const outcome = await scanSingleLead(lead);

    switch (outcome.type) {
      case "skipped":
        skipped++;
        break;
      case "no_website":
        markedNoEmail++;
        processed++;
        updatedPlaceIds.add(outcome.placeId);
        break;
      case "email":
        emailsFound++;
        processed++;
        updatedPlaceIds.add(outcome.placeId);
        break;
      case "contact_form":
        contactFormsFound++;
        markedNoEmail++;
        processed++;
        updatedPlaceIds.add(outcome.placeId);
        break;
      case "no_email":
        markedNoEmail++;
        processed++;
        updatedPlaceIds.add(outcome.placeId);
        break;
    }
  }

  const updatedLeads = [...updatedPlaceIds]
    .map((placeId) => getLeadByPlaceId(placeId))
    .filter((lead): lead is Lead => lead !== null);

  return NextResponse.json({
    processed,
    skipped,
    emailsFound,
    contactFormsFound,
    markedNoEmail,
    updatedLeads,
  });
}
