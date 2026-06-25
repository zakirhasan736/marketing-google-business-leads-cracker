import type { HeadlessRenderReport } from "@/lib/types/site-audit";

const NAV_TIMEOUT_MS = 45_000;
const HYDRATION_WAIT_MS = 2_500;

function countWords(text: string): number {
  return text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function buildVerdict(params: {
  rawWordCount: number;
  renderedWordCount: number;
  contentGainPercent: number;
}): Pick<HeadlessRenderReport, "verdict" | "summary"> {
  const { rawWordCount, renderedWordCount, contentGainPercent } = params;
  const gain = contentGainPercent / 100;

  if (rawWordCount < 100 && renderedWordCount >= 250 && gain >= 2) {
    return {
      verdict: "csr_confirmed",
      summary:
        "Headless browser loaded significantly more text than raw HTML — page relies on JavaScript rendering.",
    };
  }

  if (gain >= 2.2 && renderedWordCount > rawWordCount + 150) {
    return {
      verdict: "csr_confirmed",
      summary:
        "JavaScript adds most visible content after page load. Search bots that do not execute JS may miss key text.",
    };
  }

  if (gain >= 1.25 && gain < 2.2) {
    return {
      verdict: "hybrid_confirmed",
      summary:
        "Some content is server-rendered, but JavaScript still adds meaningful text after hydration.",
    };
  }

  if (gain >= 0.8 && gain <= 1.2 && rawWordCount >= 120) {
    return {
      verdict: "ssr_confirmed",
      summary:
        "Rendered browser output closely matches raw HTML — strong sign of server-side rendering.",
    };
  }

  return {
    verdict: "inconclusive",
    summary:
      "Headless render did not produce a clear SSR/CSR pattern. Review signals and bot parity manually.",
  };
}

export async function runHeadlessRenderCheck(params: {
  url: string;
  strategy: "mobile" | "desktop";
  rawWordCount: number;
}): Promise<HeadlessRenderReport> {
  const started = Date.now();

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
        viewport:
          params.strategy === "mobile"
            ? { width: 390, height: 844 }
            : { width: 1366, height: 768 },
        deviceScaleFactor: params.strategy === "mobile" ? 2 : 1,
        isMobile: params.strategy === "mobile",
      });

      const page = await context.newPage();
      await page.goto(params.url, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });

      // Allow client frameworks to hydrate/render.
      await page.waitForTimeout(HYDRATION_WAIT_MS);

      try {
        await page.waitForLoadState("networkidle", { timeout: 8_000 });
      } catch {
        // networkidle is best-effort; dom + hydration wait is enough for most sites
      }

      const extracted = await page.evaluate(() => {
        const clone = document.body?.cloneNode(true) as HTMLElement | null;
        if (clone) {
          clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
        }
        const text = clone?.innerText ?? document.body?.innerText ?? "";
        const title = document.title?.trim() || null;
        const h1 = Array.from(document.querySelectorAll("h1"))
          .map((el) => el.textContent?.trim() ?? "")
          .filter(Boolean);
        return { text, title, h1 };
      });

      await context.close();

      const renderedWordCount = countWords(extracted.text);
      const rawWordCount = params.rawWordCount;
      const contentGainPercent =
        rawWordCount > 0
          ? Math.round((renderedWordCount / rawWordCount) * 100)
          : renderedWordCount > 0
            ? 100
            : 0;

      const { verdict, summary } = buildVerdict({
        rawWordCount,
        renderedWordCount,
        contentGainPercent,
      });

      return {
        enabled: true,
        success: true,
        rawWordCount,
        renderedWordCount,
        contentGainPercent,
        renderTimeMs: Date.now() - started,
        renderedTitle: extracted.title,
        renderedH1: extracted.h1,
        verdict,
        summary,
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Headless render check failed";

    const hint = message.includes("Executable doesn't exist")
      ? " Run: npx playwright install chromium"
      : "";

    return {
      enabled: true,
      success: false,
      error: `${message}${hint}`,
      rawWordCount: params.rawWordCount,
      renderedWordCount: 0,
      contentGainPercent: 0,
      renderTimeMs: Date.now() - started,
      renderedTitle: null,
      renderedH1: [],
      verdict: "inconclusive",
      summary: "Headless render check could not complete.",
    };
  }
}
