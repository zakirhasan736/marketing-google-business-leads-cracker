/** Extract share token from a saved site audit URL (`/audit/{token}`). */
export function extractSiteAuditShareToken(shareUrl: string): string | null {
  try {
    const pathname = new URL(shareUrl, "http://localhost").pathname;
    const match = pathname.match(/\/audit\/([^/]+)\/?$/);
    return match?.[1] ?? null;
  } catch {
    const match = shareUrl.match(/\/audit\/([^/?#]+)/);
    return match?.[1] ?? null;
  }
}
