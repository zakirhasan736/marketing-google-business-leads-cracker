import { NextResponse } from "next/server";
import { discoverEmailFromWebsite } from "@/server/services/email-scraper.service";

export async function POST(request: Request) {
  const body = await request.json();
  const { url } = body;

  if (!url || url === "N/A") {
    return NextResponse.json({
      email: null,
      contactFormDetected: false,
      contactPageUrl: null,
    });
  }

  try {
    const result = await discoverEmailFromWebsite(url);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error scraping website:", error);
    return NextResponse.json({
      email: null,
      contactFormDetected: false,
      contactPageUrl: null,
    });
  }
}
