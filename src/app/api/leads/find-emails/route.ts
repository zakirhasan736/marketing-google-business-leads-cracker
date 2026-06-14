import { NextResponse } from "next/server";
import type { Lead } from "@/lib/types";
import {
  getAllLeads,
  getLeadByPlaceId,
  updateLead,
} from "@/server/repositories/leads.repository";
import { discoverEmailFromWebsite } from "@/server/services/email-scraper.service";

function processLeadEmailScan(lead: Lead) {
  if (lead.email) {
    return { skipped: true as const };
  }

  if (!lead.website || lead.website === "N/A") {
    updateLead(lead.placeId, { status: "No Email" });
    return { outcome: "no_email" as const, reason: "no_website" as const };
  }

  return { needsScrape: true as const, lead };
}

export async function POST(request: Request) {
  const body = await request.json();
  const leads: Lead[] = body.leads ?? [];

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json(
      { error: "leads array is required" },
      { status: 400 }
    );
  }

  let emailsFound = 0;
  let contactFormsFound = 0;
  let markedNoEmail = 0;
  let skipped = 0;
  let processed = 0;

  for (const lead of leads) {
    const check = processLeadEmailScan(lead);

    if ("skipped" in check && check.skipped) {
      skipped++;
      continue;
    }

    if ("outcome" in check && check.outcome === "no_email") {
      markedNoEmail++;
      processed++;
      continue;
    }

    processed++;
    const discovery = await discoverEmailFromWebsite(lead.website);

    if (discovery.email) {
      updateLead(lead.placeId, {
        email: discovery.email,
        status: "Collected",
        contactPageUrl: discovery.contactPageUrl,
      });
      emailsFound++;
    } else if (discovery.contactFormDetected && discovery.contactPageUrl) {
      updateLead(lead.placeId, {
        status: "No Email",
        contactPageUrl: discovery.contactPageUrl,
        note: lead.note || "Contact form only — no email found",
      });
      contactFormsFound++;
      markedNoEmail++;
    } else {
      updateLead(lead.placeId, { status: "No Email" });
      markedNoEmail++;
    }
  }

  return NextResponse.json({
    processed,
    skipped,
    emailsFound,
    contactFormsFound,
    markedNoEmail,
    leads: getAllLeads(),
  });
}
