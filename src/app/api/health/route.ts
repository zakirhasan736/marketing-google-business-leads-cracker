import { NextResponse } from "next/server";
import { isGoogleMapsConfigured } from "@/server/config/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    googleMapsConfigured: isGoogleMapsConfigured(),
  });
}
