import type { HeatmapScanResult } from "@/lib/types/heatmap";

export interface HeatmapCoverageInfo {
  gridLabel: string;
  spacingKm: number;
  radiusKm: number;
  spanKm: number;
  pointCount: number;
  shortLabel: string;
  detailLabel: string;
}

export function getHeatmapCoverageInfo(
  result: HeatmapScanResult
): HeatmapCoverageInfo {
  const { gridSize, spacingKm, cells } = result;
  const half = Math.floor(gridSize / 2);
  const radiusKm = half * spacingKm;
  const spanKm = (gridSize - 1) * spacingKm;

  return {
    gridLabel: `${gridSize}×${gridSize}`,
    spacingKm,
    radiusKm,
    spanKm,
    pointCount: cells.length,
    shortLabel: `~${spanKm.toFixed(1)} km scan area`,
    detailLabel: `${gridSize}×${gridSize} grid · ${spacingKm} km between points · ~${radiusKm.toFixed(1)} km from your pin`,
  };
}
