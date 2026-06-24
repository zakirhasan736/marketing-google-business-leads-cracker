import type { HeatmapScanResult } from "@/lib/types/heatmap";
import { getRankStyle } from "@/lib/utils/heatmap-colors";

function resolveMapUrl(mapUrl: string): string {
  if (mapUrl.startsWith("http")) return mapUrl;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${mapUrl}`;
  }
  return mapUrl;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Renders the heatmap map + rank grid to a JPEG data URL for PDF export. */
export async function renderHeatmapImageDataUrl(
  result: HeatmapScanResult
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  try {
    const img = await loadImage(resolveMapUrl(result.mapUrl));
    const size = 640;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, size, size);

    const padding = size * 0.08;
    const gridArea = size - padding * 2;
    const cellSize = gridArea / result.gridSize;

    for (const cell of result.cells) {
      const x = padding + cell.col * cellSize + cellSize / 2;
      const y = padding + cell.row * cellSize + cellSize / 2;
      const style = getRankStyle(cell.rank);
      const radius = cell.isCenter ? cellSize * 0.36 : cellSize * 0.26;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = style.backgroundColor;
      ctx.fill();

      if (cell.isCenter) {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${cell.isCenter ? 13 : 10}px Roboto, Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(style.label, x, y);
    }

    const center = Math.floor(result.gridSize / 2);
    const pinX = padding + center * cellSize + cellSize / 2;
    const pinY = padding + center * cellSize + cellSize / 2 - cellSize * 0.12;

    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(pinX, pinY - 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pinX, pinY - 2);
    ctx.lineTo(pinX - 5, pinY + 6);
    ctx.lineTo(pinX + 5, pinY + 6);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return null;
  }
}
