import { NextResponse } from "next/server";
import { getSiteAuditReportByToken } from "@/server/repositories/site-audit-reports.repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const report = getSiteAuditReportByToken(token);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ report });
}
