import {
  extractEmailsFromHtml,
  pickBestEmail,
} from "@/server/services/email-extractors";

const NAV_TIMEOUT_MS = 25_000;
const HYDRATION_WAIT_MS = 2_500;

const BROWSER_EXTRACT_FN = () => {
  const found: string[] = [];
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  const stripInvisible = (s: string) =>
    s.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");

  const collect = (text: string) => {
    const clean = stripInvisible(text);
    for (const m of clean.matchAll(emailRe)) found.push(m[0]);
    const deobfuscated = clean.replace(
      /([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\s+at\s+)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\s+dot\s+)\s*([a-zA-Z]{2,})/gi,
      "$1@$2.$3"
    );
    for (const m of deobfuscated.matchAll(emailRe)) found.push(m[0]);
  };

  const decodeCf = (encoded: string): string | null => {
    if (!encoded || encoded.length < 4) return null;
    try {
      const key = parseInt(encoded.slice(0, 2), 16);
      let email = "";
      for (let i = 2; i < encoded.length; i += 2) {
        email += String.fromCharCode(
          parseInt(encoded.slice(i, i + 2), 16) ^ key
        );
      }
      return email.includes("@") ? email : null;
    } catch {
      return null;
    }
  };

  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
    const href = (a as HTMLAnchorElement).href
      .replace(/^mailto:/i, "")
      .split("?")[0];
    if (href) {
      try {
        found.push(decodeURIComponent(href));
      } catch {
        found.push(href);
      }
    }
  });

  document
    .querySelectorAll(
      "[data-cfemail], .__cf_email__, a[href*='/cdn-cgi/l/email-protection']"
    )
    .forEach((el) => {
      const enc =
        el.getAttribute("data-cfemail") ??
        (el as HTMLAnchorElement).href?.split("#")[1] ??
        "";
      const decoded = decodeCf(enc);
      if (decoded) found.push(decoded);
    });

  document
    .querySelectorAll(
      "footer, header, nav, aside, [role=navigation], [role=contentinfo], .footer, .header, .contact, .contact-info, #footer, #contact"
    )
    .forEach((el) => {
      collect(el.textContent ?? "");
      collect(el.innerHTML ?? "");
    });

  document
    .querySelectorAll("[data-email], [data-mail], [data-contact-email]")
    .forEach((el) => {
      ["data-email", "data-mail", "data-contact-email"].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v) collect(v);
      });
    });

  document.querySelectorAll("a, span, p, div").forEach((el) => {
    const kids = Array.from(el.children);
    if (kids.length >= 2) {
      const joined = kids.map((c) => c.textContent?.trim() ?? "").join("");
      if (joined.includes("@")) collect(joined);
    }
  });

  document
    .querySelectorAll("[title], [aria-label], [alt], [onclick]")
    .forEach((el) => {
      ["title", "aria-label", "alt", "onclick"].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v) collect(v);
      });
    });

  collect(document.body?.innerText ?? "");
  collect(document.documentElement.outerHTML);

  return [...new Set(found.map((e) => e.trim().toLowerCase()))];
};

async function renderPageInBrowser(
  url: string
): Promise<{ html: string | null; browserEmails: string[] }> {
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
      await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight)
      );
      await page.waitForTimeout(800);
    } catch {
      // scroll triggers lazy-loaded footers on some sites
    }

    try {
      await page.waitForLoadState("networkidle", { timeout: 6_000 });
    } catch {
      // continue with hydrated DOM
    }

    const [html, browserEmails] = await Promise.all([
      page.content(),
      page.evaluate(BROWSER_EXTRACT_FN),
    ]);

    await context.close();
    return { html, browserEmails };
  } finally {
    await browser.close();
  }
}

export async function fetchRenderedHtml(url: string): Promise<string | null> {
  try {
    const { html } = await renderPageInBrowser(url);
    return html;
  } catch {
    return null;
  }
}

export async function discoverEmailFromRenderedPage(
  url: string,
  siteHostname?: string
): Promise<{ email: string | null; hasContactForm: boolean }> {
  try {
    const { html, browserEmails } = await renderPageInBrowser(url);
    if (!html) return { email: null, hasContactForm: false };

    const staticResult = extractEmailsFromHtml(html, siteHostname);
    const bestEmail = pickBestEmail(
      [
        ...browserEmails,
        ...(staticResult.email ? [staticResult.email] : []),
      ],
      siteHostname
    );

    return {
      email: bestEmail,
      hasContactForm: staticResult.hasContactForm,
    };
  } catch {
    return { email: null, hasContactForm: false };
  }
}
