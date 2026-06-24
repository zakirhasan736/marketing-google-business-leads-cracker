import { randomBytes } from "crypto";
import { getDatabase } from "@/server/database/client";
import type { PublicSiteAuditReport } from "@/lib/types/site-audit";

export function saveSiteAuditReport(report: PublicSiteAuditReport): string {
  const token = randomBytes(12).toString("base64url");
  const now = new Date().toISOString();

  getDatabase()
    .prepare(
      `INSERT INTO site_audit_reports (token, business_name, report_json, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(token, report.lead.name, JSON.stringify(report), now);

  return token;
}

export function getSiteAuditReportByToken(
  token: string
): PublicSiteAuditReport | null {
  const row = getDatabase()
    .prepare(`SELECT report_json FROM site_audit_reports WHERE token = ?`)
    .get(token) as { report_json: string } | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.report_json) as PublicSiteAuditReport;
  } catch {
    return null;
  }
}
