/** Extract share token from a saved heatmap report URL (`/report/{token}`). */
export function extractHeatmapShareToken(shareUrl: string): string | null {
  try {
    const pathname = new URL(shareUrl, "http://localhost").pathname;
    const match = pathname.match(/\/report\/([^/]+)\/?$/);
    return match?.[1] ?? null;
  } catch {
    const match = shareUrl.match(/\/report\/([^/?#]+)/);
    return match?.[1] ?? null;
  }
}
