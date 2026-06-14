import * as cheerio from "cheerio";
import { extractEmailsFromHtml } from "@/server/services/email-extractors";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; LeadGenBot/1.0; +https://localhost)",
  Accept: "text/html,application/xhtml+xml",
};

const COMMON_PATHS = [
  "/contact",
  "/contact-us",
  "/contact-us/",
  "/get-in-touch",
  "/reach-us",
  "/about",
  "/about-us",
  "/team",
  "/contacts",
  "/support",
  "/connect",
  "/inquiries",
  "/enquiries",
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

export interface EmailDiscoveryResult {
  email: string | null;
  contactFormDetected: boolean;
  contactPageUrl: string | null;
}

async function fetchPageHtml(pageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(pageUrl, {
      signal: AbortSignal.timeout(8000),
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

async function crawlContactPages(
  targetUrl: string,
  visited: Set<string>
): Promise<{ email: string | null; hasContactForm: boolean; pageUrl: string | null }> {
  if (visited.size > 8) {
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

    for (const link of potentialLinks.slice(0, 6)) {
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

  let contactFormDetected = false;
  let contactPageUrl: string | null = null;

  const homepage = await extractFromPage(url);
  if (homepage.email) {
    return {
      email: homepage.email,
      contactFormDetected: homepage.hasContactForm,
      contactPageUrl: homepage.hasContactForm ? url : null,
    };
  }
  if (homepage.hasContactForm) {
    contactFormDetected = true;
    contactPageUrl = url;
  }

  for (const pagePath of COMMON_PATHS) {
    try {
      const fullUrl = new URL(pagePath, url).toString();
      const result = await extractFromPage(fullUrl);
      if (result.email) {
        return {
          email: result.email,
          contactFormDetected: result.hasContactForm,
          contactPageUrl: fullUrl,
        };
      }
      if (result.hasContactForm) {
        contactFormDetected = true;
        contactPageUrl = fullUrl;
      }
    } catch {
      // ignore invalid URL
    }
  }

  const crawled = await crawlContactPages(url, new Set([url]));
  if (crawled.email) {
    return {
      email: crawled.email,
      contactFormDetected: crawled.hasContactForm,
      contactPageUrl: crawled.pageUrl,
    };
  }

  return {
    email: null,
    contactFormDetected: contactFormDetected || crawled.hasContactForm,
    contactPageUrl: contactPageUrl ?? crawled.pageUrl,
  };
}
