import { randomBytes } from "crypto";
import { getDatabase } from "@/server/database/client";
import type { PublicHeatmapReport } from "@/lib/types/heatmap";

function generateToken(): string {
  return randomBytes(12).toString("base64url");
}

export function saveHeatmapReport(report: PublicHeatmapReport): string {
  const token = generateToken();
  const now = new Date().toISOString();

  getDatabase()
    .prepare(
      `INSERT INTO heatmap_reports (token, business_name, report_json, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      token,
      report.lead.name,
      JSON.stringify(report),
      now
    );

  return token;
}

export function getHeatmapReportByToken(
  token: string
): PublicHeatmapReport | null {
  const row = getDatabase()
    .prepare(
      `SELECT report_json FROM heatmap_reports WHERE token = ?`
    )
    .get(token) as { report_json: string } | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.report_json) as PublicHeatmapReport;
  } catch {
    return null;
  }
}
