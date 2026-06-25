import type { HeatmapScanResult, PublicHeatmapLeadSnapshot } from "@/lib/types/heatmap";
import { buildHeatmapPdf } from "@/lib/pdf/build-heatmap-pdf";
import { downloadCsv } from "@/lib/utils/export-leads";
import { mergeHeatmapOpportunities } from "@/lib/utils/heatmap-insights";

function escapeCsv(value: string): string {  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** PDF saved using the reported business name, e.g. "Acme Spa.pdf" */
export function heatmapPdfFilename(businessName: string): string {
  const safe = businessName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${safe || "SEO Report"}.pdf`;
}

export function heatmapToCsv(
  lead: PublicHeatmapLeadSnapshot,
  result: HeatmapScanResult
): string {
  const date = new Date().toISOString().slice(0, 10);
  const sections: string[] = [];

  sections.push("SEO Heatmap Report");
  sections.push(
    [
      "Business",
      "Address",
      "Keyword",
      "Grade",
      "Visibility Score",
      "Rank at Pin",
      "Avg Rank",
      "Top 3 %",
      "Page 1 %",
      "Blind Spots %",
      "Date",
    ].join(",")
  );
  sections.push(
    [
      lead.name,
      lead.address,
      result.keyword,
      result.insights.grade,
      String(result.insights.visibilityScore),
      result.insights.businessRankLabel,
      String(result.summary.avgRank),
      String(result.summary.top3Percent),
      String(result.summary.page1Percent),
      String(result.summary.notRankingPercent),
      date,
    ]
      .map((v) => escapeCsv(String(v)))
      .join(",")
  );

  sections.push("");
  sections.push("Grid Cells");
  sections.push(["Row", "Col", "Latitude", "Longitude", "Rank", "Is Center"].join(","));
  for (const cell of result.cells) {
    sections.push(
      [
        String(cell.row),
        String(cell.col),
        String(cell.lat),
        String(cell.lng),
        String(cell.rank),
        cell.isCenter ? "yes" : "no",
      ].join(",")
    );
  }

  if (result.competitors.length > 0) {
    sections.push("");
    sections.push("Competitors at Pin");
    sections.push(["Rank", "Name", "Rating", "Reviews", "Is Target"].join(","));
    for (const c of result.competitors) {
      sections.push(
        [
          String(c.rank),
          c.name,
          c.rating != null ? String(c.rating) : "",
          c.userRatingsTotal != null ? String(c.userRatingsTotal) : "",
          c.isTarget ? "yes" : "no",
        ]
          .map((v) => escapeCsv(String(v)))
          .join(",")
      );
    }
  }

  sections.push("");
  sections.push("Insights");
  sections.push(["Type", "Detail"].join(","));
  for (const issue of result.insights.issues) {
    sections.push([escapeCsv("Issue"), escapeCsv(issue)].join(","));
  }
  for (const opp of mergeHeatmapOpportunities(result.insights.opportunities)) {
    sections.push([escapeCsv("Opportunity"), escapeCsv(opp)].join(","));
  }
  sections.push([escapeCsv("Pitch"), escapeCsv(result.insights.pitch)].join(","));

  return sections.join("\n");
}

export function downloadHeatmapCsv(
  lead: PublicHeatmapLeadSnapshot,
  result: HeatmapScanResult
): void {
  const csv = heatmapToCsv(lead, result);
  const filename = `heatmap-${slugify(lead.name)}-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(csv, filename);
}

export async function downloadHeatmapPdf(
  lead: PublicHeatmapLeadSnapshot,
  result: HeatmapScanResult
): Promise<void> {
  const doc = await buildHeatmapPdf(lead, result);
  doc.save(heatmapPdfFilename(lead.name));
}