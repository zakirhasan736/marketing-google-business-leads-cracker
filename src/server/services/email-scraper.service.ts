import * as cheerio from "cheerio";
import { extractEmailsFromHtml } from "@/server/services/email-extractors";

const FETCH_TIMEOUT_MS = 5000;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; LeadGenBot/1.0; +https://localhost)",
  Accept: "text/html,application/xhtml+xml",
};

const PRIORITY_PATHS = [
  "/contact",
  "/contact-us",
  "/contact-us/",
  "/about",
  "/about-us",
  "/get-in-touch",
];

const SECONDARY_PATHS = [
  "/reach-us",
  "/team",
  "/contacts",
  "/support",
  "/connect",
];

const CONTACT_LINK_KEYWORDS = [
  "contact",
  "about",
  "support",
  "get-in-touch",
  "reach",
  "connect",
  "inquir",
  "enquir",
];

const PARALLEL_FETCH_CHUNK = 4;

export interface EmailDiscoveryResult {
  email: string | null;
  contactFormDetected: boolean;
  contactPageUrl: string | null;
}

async function fetchPageHtml(pageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(pageUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function getHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

async function extractFromPage(
  pageUrl: string
): Promise<{ email: string | null; hasContactForm: boolean }> {
  const html = await fetchPageHtml(pageUrl);
  if (!html) return { email: null, hasContactForm: false };
  return extractEmailsFromHtml(html, getHostname(pageUrl));
}

function resolvePageUrls(baseUrl: string, paths: string[]): string[] {
  const urls: string[] = [];
  for (const pagePath of paths) {
    try {
      urls.push(new URL(pagePath, baseUrl).toString());
    } catch {
      // ignore invalid URL
    }
  }
  return urls;
}

async function scanPagesInParallel(
  pageUrls: string[]
): Promise<{ email: string | null; hasContactForm: boolean; pageUrl: string | null }> {
  let contactFormDetected = false;
  let contactPageUrl: string | null = null;

  for (let i = 0; i < pageUrls.length; i += PARALLEL_FETCH_CHUNK) {
    const chunk = pageUrls.slice(i, i + PARALLEL_FETCH_CHUNK);
    const results = await Promise.all(
      chunk.map(async (pageUrl) => ({
        pageUrl,
        ...(await extractFromPage(pageUrl)),
      }))
    );

    for (const result of results) {
      if (result.email) {
        return {
          email: result.email,
          hasContactForm: result.hasContactForm,
          pageUrl: result.pageUrl,
        };
      }
      if (result.hasContactForm) {
        contactFormDetected = true;
        contactPageUrl = result.pageUrl;
      }
    }
  }

  return {
    email: null,
    hasContactForm: contactFormDetected,
    pageUrl: contactPageUrl,
  };
}

async function crawlContactPages(
  targetUrl: string,
  visited: Set<string>
): Promise<{ email: string | null; hasContactForm: boolean; pageUrl: string | null }> {
  if (visited.size > 4) {
    return { email: null, hasContactForm: false, pageUrl: null };
  }
  visited.add(targetUrl);

  try {
    const html = await fetchPageHtml(targetUrl);
    if (!html) return { email: null, hasContactForm: false, pageUrl: null };

    const direct = extractEmailsFromHtml(html, getHostname(targetUrl));
    if (direct.email) {
      return { email: direct.email, hasContactForm: direct.hasContactForm, pageUrl: targetUrl };
    }

    const $ = cheerio.load(html);
    const potentialLinks: string[] = [];

    $("a[href]").each((_, link) => {
      const href = $(link).attr("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

      const label = `${href} ${$(link).text()}`.toLowerCase();
      if (!CONTACT_LINK_KEYWORDS.some((kw) => label.includes(kw))) return;

      try {
        const fullUrl = new URL(href, targetUrl).toString();
        if (
          !visited.has(fullUrl) &&
          getHostname(fullUrl) === getHostname(targetUrl)
        ) {
          potentialLinks.push(fullUrl);
        }
      } catch {
        // ignore invalid URLs
      }
    });

    let foundContactForm = direct.hasContactForm;
    let contactPageUrl: string | null = foundContactForm ? targetUrl : null;

    for (const link of potentialLinks.slice(0, 3)) {
      const result = await extractFromPage(link);
      if (result.email) {
        return { email: result.email, hasContactForm: result.hasContactForm, pageUrl: link };
      }
      if (result.hasContactForm) {
        foundContactForm = true;
        contactPageUrl = link;
      }
    }

    return {
      email: null,
      hasContactForm: foundContactForm,
      pageUrl: contactPageUrl,
    };
  } catch {
    return { email: null, hasContactForm: false, pageUrl: null };
  }
}

export async function findEmailFromWebsite(
  url: string | null | undefined
): Promise<string | null> {
  const result = await discoverEmailFromWebsite(url);
  return result.email;
}

export async function discoverEmailFromWebsite(
  url: string | null | undefined
): Promise<EmailDiscoveryResult> {
  if (!url || url === "N/A") {
    return { email: null, contactFormDetected: false, contactPageUrl: null };
  }

  const priorityUrls = [url, ...resolvePageUrls(url, PRIORITY_PATHS)];
  const priority = await scanPagesInParallel(priorityUrls);
  if (priority.email) {
    return {
      email: priority.email,
      contactFormDetected: priority.hasContactForm,
      contactPageUrl: priority.pageUrl,
    };
  }

  const secondary = await scanPagesInParallel(resolvePageUrls(url, SECONDARY_PATHS));
  if (secondary.email) {
    return {
      email: secondary.email,
      contactFormDetected: secondary.hasContactForm,
      contactPageUrl: secondary.pageUrl,
    };
  }

  const crawled = await crawlContactPages(url, new Set([url, ...priorityUrls]));
  if (crawled.email) {
    return {
      email: crawled.email,
      contactFormDetected: crawled.hasContactForm,
      contactPageUrl: crawled.pageUrl,
    };
  }

  const contactFormDetected =
    priority.hasContactForm || secondary.hasContactForm || crawled.hasContactForm;
  const contactPageUrl =
    priority.pageUrl ?? secondary.pageUrl ?? crawled.pageUrl ?? null;

  return {
    email: null,
    contactFormDetected,
    contactPageUrl,
  };
}
