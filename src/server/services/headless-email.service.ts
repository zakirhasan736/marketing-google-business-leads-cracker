import { extractEmailsFromHtml } from "@/server/services/email-extractors";

const NAV_TIMEOUT_MS = 20_000;
const HYDRATION_WAIT_MS = 2_000;

export async function fetchRenderedHtml(url: string): Promise<string | null> {
  try {
    const { chromium } = await import("playwright");

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1366, height: 768 },
      });

      const page = await context.newPage();
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });

      await page.waitForTimeout(HYDRATION_WAIT_MS);

      try {
        await page.waitForLoadState("networkidle", { timeout: 5_000 });
      } catch {
        // best-effort hydration wait is enough for most sites
      }

      const html = await page.content();
      await context.close();
      return html;
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

export async function discoverEmailFromRenderedPage(
  url: string,
  siteHostname?: string
): Promise<{ email: string | null; hasContactForm: boolean }> {
  const html = await fetchRenderedHtml(url);
  if (!html) return { email: null, hasContactForm: false };
  return extractEmailsFromHtml(html, siteHostname);
}
