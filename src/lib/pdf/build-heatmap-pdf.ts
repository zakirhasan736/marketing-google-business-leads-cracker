import type { HeatmapScanResult, PublicHeatmapLeadSnapshot } from "@/lib/types/heatmap";
import { getRankStyle } from "@/lib/utils/heatmap-colors";
import { getHeatmapCoverageInfo } from "@/lib/utils/heatmap-coverage";
import { PDF_CONTENT_WIDTH, PDF_THEME } from "@/lib/pdf/heatmap-pdf-theme";
import { registerRobotoFonts } from "@/lib/pdf/register-roboto";
import { renderHeatmapImageDataUrl } from "@/lib/utils/heatmap-export-image";

type JsPdfWithAutoTable = import("jspdf").jsPDF & {
  lastAutoTable: { finalY: number };
};

const { margin, pageWidth, pageHeight } = PDF_THEME;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setFill(doc: import("jspdf").jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setStroke(doc: import("jspdf").jsPDF, rgb: [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: import("jspdf").jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function setRoboto(
  doc: import("jspdf").jsPDF,
  style: "normal" | "bold" = "normal",
  size = 10
) {
  doc.setFont("Roboto", style);
  doc.setFontSize(size);
}

function drawHeaderBand(
  doc: import("jspdf").jsPDF,
  lead: PublicHeatmapLeadSnapshot,
  result: HeatmapScanResult,
  coverageLabel: string
): number {
  const bandHeight = 118;
  setFill(doc, PDF_THEME.primary);
  doc.rect(0, 0, pageWidth, bandHeight, "F");

  setRoboto(doc, "bold", 9);
  setText(doc, PDF_THEME.primaryLight);
  doc.text("SEO HEATMAP REPORT", margin, 28);

  const gradeColor = hexToRgb(result.insights.gradeColor);
  const badgeW = 52;
  const badgeH = 20;
  const badgeX = pageWidth - margin - badgeW;
  setFill(doc, gradeColor);
  doc.roundedRect(badgeX, 16, badgeW, badgeH, 10, 10, "F");
  setRoboto(doc, "bold", 9);
  setText(doc, PDF_THEME.white);
  doc.text(`GRADE ${result.insights.grade}`, badgeX + badgeW / 2, 29, {
    align: "center",
  });

  setRoboto(doc, "bold", 18);
  setText(doc, PDF_THEME.white);
  const titleLines = doc.splitTextToSize(lead.name, PDF_CONTENT_WIDTH - badgeW - 12);
  doc.text(titleLines, margin, 48);

  setRoboto(doc, "normal", 9);
  setText(doc, [219, 234, 254]);
  doc.text(lead.address, margin, 66);

  const meta = `Keyword: ${result.keyword}  ·  ${coverageLabel}  ·  ${new Date().toLocaleDateString()}`;
  doc.text(meta, margin, 82);

  setFill(doc, PDF_THEME.white);
  doc.roundedRect(margin, 94, PDF_CONTENT_WIDTH, 28, 6, 6, "F");
  setRoboto(doc, "normal", 8);
  setText(doc, PDF_THEME.slate500);
  doc.text(coverageLabel, margin + 10, 108);
  setRoboto(doc, "bold", 8);
  setText(doc, PDF_THEME.slate700);
  const coverage = getHeatmapCoverageInfo(result);
  doc.text(coverage.detailLabel, margin + 10, 118);

  return bandHeight + 16;
}

function drawKpiRow(
  doc: import("jspdf").jsPDF,
  result: HeatmapScanResult,
  rankColor: string,
  y: number
): number {
  const cards = [
    {
      label: "Rank at pin",
      value: result.insights.businessRankLabel,
      color: rankColor,
    },
    {
      label: "Visibility",
      value: String(result.insights.visibilityScore),
      color: result.insights.gradeColor,
    },
    {
      label: "Top 3",
      value: `${result.summary.top3Percent}%`,
      color: "#16a34a",
    },
    {
      label: "Blind spots",
      value: `${result.summary.notRankingPercent}%`,
      color: "#dc2626",
    },
  ];

  const gap = 10;
  const cardW = (PDF_CONTENT_WIDTH - gap * 3) / 4;
  const cardH = 54;

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + gap);
    setFill(doc, PDF_THEME.white);
    setStroke(doc, PDF_THEME.slate200);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, cardW, cardH, 8, 8, "FD");

    setRoboto(doc, "normal", 7);
    setText(doc, PDF_THEME.slate500);
    doc.text(card.label.toUpperCase(), x + 10, y + 16);

    const rgb = hexToRgb(card.color);
    setRoboto(doc, "bold", 16);
    setText(doc, rgb);
    doc.text(card.value, x + 10, y + 36);
  });

  return y + cardH + 18;
}

function drawSectionTitle(doc: import("jspdf").jsPDF, title: string, y: number): number {
  setFill(doc, PDF_THEME.primary);
  doc.roundedRect(margin, y, 3, 14, 1, 1, "F");
  setRoboto(doc, "bold", 11);
  setText(doc, PDF_THEME.slate900);
  doc.text(title, margin + 10, y + 11);
  return y + 22;
}

function tableStyles() {
  return {
    font: "Roboto",
    fontSize: 9,
    cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
    lineColor: PDF_THEME.slate200,
    lineWidth: 0.4,
    textColor: PDF_THEME.slate700,
  };
}

function tableHeadStyles() {
  return {
    font: "Roboto",
    fontStyle: "bold" as const,
    fillColor: PDF_THEME.primary,
    textColor: PDF_THEME.white,
    cellPadding: { top: 7, right: 8, bottom: 7, left: 8 },
  };
}

export async function buildHeatmapPdf(
  lead: PublicHeatmapLeadSnapshot,
  result: HeatmapScanResult
): Promise<import("jspdf").jsPDF> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await registerRobotoFonts(doc);

  const centerCell = result.cells.find((c) => c.isCenter);
  const rankColor = centerCell
    ? getRankStyle(centerCell.rank).backgroundColor
    : "#dc2626";

  const coverage = getHeatmapCoverageInfo(result);
  let y = drawHeaderBand(doc, lead, result, coverage.shortLabel);
  y = drawKpiRow(doc, result, rankColor, y);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = margin;
    }
  };

  y = drawSectionTitle(doc, "Summary", y);
  ensureSpace(80);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Metric", "Value"]],
    body: [
      ["Grade", result.insights.grade],
      ["Visibility score", String(result.insights.visibilityScore)],
      ["Rank at pin", result.insights.businessRankLabel],
      ["Average rank", String(result.summary.avgRank)],
      ["Top 3 coverage", `${result.summary.top3Percent}%`],
      ["Page 1 coverage", `${result.summary.page1Percent}%`],
      ["Blind spots", `${result.summary.notRankingPercent}%`],
      ["Grid spacing", `${coverage.spacingKm} km between points`],
      ["Scan radius", `~${coverage.radiusKm.toFixed(1)} km from your pin`],
      ["Total span", `~${coverage.spanKm.toFixed(1)} km`],
    ],
    theme: "plain",
    styles: tableStyles(),
    alternateRowStyles: { fillColor: PDF_THEME.slate50 },
    headStyles: tableHeadStyles(),
    columnStyles: {
      0: { cellWidth: 170, fontStyle: "bold", textColor: PDF_THEME.slate500 },
      1: { cellWidth: "auto" },
    },
  });
  y = (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 18;

  if (result.competitors.length > 0) {
    y = drawSectionTitle(doc, "Rankings at your pin", y);
    ensureSpace(60);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Rank", "Business", "Rating", "Reviews"]],
      body: result.competitors.map((c) => [
        String(c.rank),
        c.isTarget ? `${c.name} (YOU)` : c.name,
        c.rating != null ? c.rating.toFixed(1) : "—",
        c.userRatingsTotal != null ? c.userRatingsTotal.toLocaleString() : "—",
      ]),
      theme: "plain",
      styles: tableStyles(),
      alternateRowStyles: { fillColor: PDF_THEME.slate50 },
      headStyles: tableHeadStyles(),
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          const row = result.competitors[data.row.index];
          if (row?.isTarget) {
            data.cell.styles.fillColor = PDF_THEME.primaryLight;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = PDF_THEME.primary;
          }
        }
      },
    });
    y = (doc as JsPdfWithAutoTable).lastAutoTable.finalY + 18;
  }

  y = drawSectionTitle(doc, "Problems found", y);
  ensureSpace(24);
  for (const issue of result.insights.issues) {
    setRoboto(doc, "normal", 9);
    const lines = doc.splitTextToSize(`•  ${issue}`, PDF_CONTENT_WIDTH - 20);
    const boxH = Math.max(24, lines.length * 12 + 12);
    ensureSpace(boxH + 6);
    setFill(doc, PDF_THEME.redLight);
    doc.roundedRect(margin, y, PDF_CONTENT_WIDTH, boxH, 5, 5, "F");
    setText(doc, PDF_THEME.red);
    doc.text(lines, margin + 10, y + 14);
    y += boxH + 6;
  }
  if (result.insights.issues.length === 0) {
    setRoboto(doc, "normal", 9);
    setText(doc, PDF_THEME.slate500);
    doc.text("No major issues identified.", margin, y + 10);
    y += 20;
  }
  y += 8;

  y = drawSectionTitle(doc, "How we can help", y);
  ensureSpace(24);
  for (const opp of result.insights.opportunities) {
    setRoboto(doc, "normal", 9);
    const lines = doc.splitTextToSize(`•  ${opp}`, PDF_CONTENT_WIDTH - 20);
    const boxH = Math.max(24, lines.length * 12 + 12);
    ensureSpace(boxH + 6);
    setFill(doc, PDF_THEME.greenLight);
    doc.roundedRect(margin, y, PDF_CONTENT_WIDTH, boxH, 5, 5, "F");
    setText(doc, PDF_THEME.green);
    doc.text(lines, margin + 10, y + 14);
    y += boxH + 6;
  }
  y += 12;

  const heatmapImage = await renderHeatmapImageDataUrl(result);
  if (heatmapImage) {
    ensureSpace(40);
    y = drawSectionTitle(doc, "Heatmap", y);
    const imgSize = PDF_CONTENT_WIDTH;
    ensureSpace(imgSize + 24);
    setFill(doc, PDF_THEME.slate50);
    setStroke(doc, PDF_THEME.slate200);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin - 4, y - 4, imgSize + 8, imgSize + 8, 10, 10, "FD");
    doc.addImage(heatmapImage, "JPEG", margin, y, imgSize, imgSize);
    y += imgSize + 16;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    setStroke(doc, PDF_THEME.slate200);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);
    setRoboto(doc, "normal", 8);
    setText(doc, PDF_THEME.slate500);
    doc.text(lead.name, margin, pageHeight - 18);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 18, {
      align: "right",
    });
  }

  return doc;
}
