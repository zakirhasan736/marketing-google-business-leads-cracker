import * as cheerio from "cheerio";
import { extractEmailsFromHtml } from "@/server/services/email-extractors";
import { discoverEmailFromRenderedPage } from "@/server/services/headless-email.service";

const FETCH_TIMEOUT_MS = 10_000;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const PRIORITY_PATHS = [
  "/contact",
  "/contact-us",
  "/contact-us/",
  "/contact.html",
  "/contact.php",
  "/about",
  "/about-us",
  "/about-us/",
  "/get-in-touch",
  "/reach-us",
  "/connect",
  "/kontakt",
  "/contacto",
];

const SECONDARY_PATHS = [
  "/team",
  "/our-team",
  "/staff",
  "/contacts",
  "/support",
  "/help",
  "/find-us",
  "/locations",
  "/location",
  "/impressum",
  "/legal",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/book",
  "/appointment",
  "/enquiry",
  "/inquiry",
  "/write-us",
  "/email-us",
  "/meet-the-team",
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
  "email",
  "mail",
  "find-us",
  "location",
  "impressum",
  "kontakt",
  "write",
  "team",
];

const REGION_LINK_SELECTORS = [
  "footer a[href]",
  "header a[href]",
  "nav a[href]",
  '[role="navigation"] a[href]',
  '[role="contentinfo"] a[href]',
  "aside a[href]",
  ".footer a[href]",
  ".header a[href]",
  ".navbar a[href]",
  ".sidebar a[href]",
  ".banner a[href]",
  ".contact a[href]",
  ".top-bar a[href]",
  '[class*="footer"] a[href]',
  '[class*="contact"] a[href]',
  '[class*="header"] a[href]',
];

const SITEMAP_CONTACT_KEYWORDS = [
  "contact",
  "about",
  "team",
  "support",
  "kontakt",
  "impressum",
  "location",
];

const PARALLEL_FETCH_CHUNK = 5;
const MAX_CRAWL_VISITS = 12;
const MAX_REGION_LINKS = 8;
const MAX_KEYWORD_LINKS = 8;
const MAX_HEADLESS_PAGES = 5;
const SPA_SHELL_TEXT_THRESHOLD = 120;

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
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xml")
    ) {
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

function isSameDomain(baseUrl: string, targetUrl: string): boolean {
  const base = getHostname(baseUrl)?.replace(/^www\./, "");
  const target = getHostname(targetUrl)?.replace(/^www\./, "");
  return base === target;
}

function getUrlVariants(url: string): string[] {
  const variants: string[] = [url];
  try {
    const parsed = new URL(url);
    if (parsed.hostname.startsWith("www.")) {
      const noWww = new URL(url);
      noWww.hostname = parsed.hostname.replace(/^www\./, "");
      variants.push(noWww.toString());
    } else {
      const withWww = new URL(url);
      withWww.hostname = `www.${parsed.hostname}`;
      variants.push(withWww.toString());
    }
  } catch {
    // ignore
  }
  return [...new Set(variants)];
}

function isLikelySpaShell(html: string): boolean {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length < SPA_SHELL_TEXT_THRESHOLD;
}

async function fetchSitemapContactUrls(baseUrl: string): Promise<string[]> {
  const sitemapPaths = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"];
  const urls: string[] = [];

  for (const path of sitemapPaths) {
    try {
      const sitemapUrl = new URL(path, baseUrl).toString();
      const xml = await fetchPageHtml(sitemapUrl);
      if (!xml) continue;

      const locMatches = xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi);
      for (const match of locMatches) {
        const loc = match[1].trim();
        const lower = loc.toLowerCase();
        if (
          SITEMAP_CONTACT_KEYWORDS.some((kw) => lower.includes(kw)) &&
          isSameDomain(baseUrl, loc)
        ) {
          urls.push(loc);
        }
      }

      if (urls.length > 0) break;
    } catch {
      // try next sitemap path
    }
  }

  return [...new Set(urls)].slice(0, 6);
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

function collectLinksFromRegions(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  visited: Set<string>
): string[] {
  const links: string[] = [];

  for (const selector of REGION_LINK_SELECTORS) {
    try {
      $(selector).each((_, link) => {
        const href = $(link).attr("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

        const label = `${href} ${$(link).text()}`.toLowerCase();
        const isContactRelated = CONTACT_LINK_KEYWORDS.some((kw) =>
          label.includes(kw)
        );

        try {
          const fullUrl = new URL(href, baseUrl).toString();
          if (
            !visited.has(fullUrl) &&
            isSameDomain(baseUrl, fullUrl) &&
            (isContactRelated ||
              selector.includes("footer") ||
              selector.includes("contact") ||
              selector.includes("header"))
          ) {
            links.push(fullUrl);
          }
        } catch {
          // ignore invalid URLs
        }
      });
    } catch {
      // invalid selector
    }
  }

  return [...new Set(links)];
}

function collectKeywordLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  visited: Set<string>
): string[] {
  const links: string[] = [];

  $("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    const label = `${href} ${$(link).text()}`.toLowerCase();
    if (!CONTACT_LINK_KEYWORDS.some((kw) => label.includes(kw))) return;

    try {
      const fullUrl = new URL(href, baseUrl).toString();
      if (!visited.has(fullUrl) && isSameDomain(baseUrl, fullUrl)) {
        links.push(fullUrl);
      }
    } catch {
      // ignore invalid URLs
    }
  });

  return [...new Set(links)];
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

async function tryHeadlessFallback(
  urls: string[],
  siteHostname?: string
): Promise<{ email: string | null; hasContactForm: boolean; pageUrl: string | null }> {
  const uniqueUrls = [...new Set(urls)].slice(0, MAX_HEADLESS_PAGES);

  for (const pageUrl of uniqueUrls) {
    const rendered = await discoverEmailFromRenderedPage(pageUrl, siteHostname);
    if (rendered.email) {
      return {
        email: rendered.email,
        hasContactForm: rendered.hasContactForm,
        pageUrl,
      };
    }
  }

  return { email: null, hasContactForm: false, pageUrl: null };
}

async function crawlContactPages(
  targetUrl: string,
  visited: Set<string>
): Promise<{ email: string | null; hasContactForm: boolean; pageUrl: string | null }> {
  if (visited.size > MAX_CRAWL_VISITS) {
    return { email: null, hasContactForm: false, pageUrl: null };
  }
  visited.add(targetUrl);

  try {
    const html = await fetchPageHtml(targetUrl);
    if (!html) return { email: null, hasContactForm: false, pageUrl: null };

    const direct = extractEmailsFromHtml(html, getHostname(targetUrl));
    if (direct.email) {
      return {
        email: direct.email,
        hasContactForm: direct.hasContactForm,
        pageUrl: targetUrl,
      };
    }

    if (isLikelySpaShell(html)) {
      const headless = await discoverEmailFromRenderedPage(
        targetUrl,
        getHostname(targetUrl)
      );
      if (headless.email) {
        return {
          email: headless.email,
          hasContactForm: headless.hasContactForm,
          pageUrl: targetUrl,
        };
      }
    }

    const $ = cheerio.load(html);
    const regionLinks = collectLinksFromRegions($, targetUrl, visited);
    const keywordLinks = collectKeywordLinks($, targetUrl, visited);
    const potentialLinks = [...new Set([...regionLinks, ...keywordLinks])];

    let foundContactForm = direct.hasContactForm;
    let contactPageUrl: string | null = foundContactForm ? targetUrl : null;

    const regionToScan = regionLinks.slice(0, MAX_REGION_LINKS);
    const keywordToScan = keywordLinks
      .filter((link) => !regionToScan.includes(link))
      .slice(0, MAX_KEYWORD_LINKS);

    for (const link of [...regionToScan, ...keywordToScan]) {
      if (visited.has(link)) continue;
      visited.add(link);

      const result = await extractFromPage(link);
      if (result.email) {
        return {
          email: result.email,
          hasContactForm: result.hasContactForm,
          pageUrl: link,
        };
      }
      if (result.hasContactForm) {
        foundContactForm = true;
        contactPageUrl = link;
      }

      if (visited.size >= MAX_CRAWL_VISITS) break;
    }

    if (!direct.email && potentialLinks.length > 0) {
      for (const link of potentialLinks.slice(0, 3)) {
        if (visited.has(link)) continue;
        const nested = await crawlContactPages(link, visited);
        if (nested.email) return nested;
        if (nested.hasContactForm) {
          foundContactForm = true;
          contactPageUrl = nested.pageUrl ?? contactPageUrl;
        }
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

  const urlVariants = getUrlVariants(url);
  const baseUrl = urlVariants[0];
  const siteHostname = getHostname(baseUrl);

  const priorityUrls = [
    ...urlVariants,
    ...urlVariants.flatMap((u) => resolvePageUrls(u, PRIORITY_PATHS)),
  ];
  const secondaryUrls = urlVariants.flatMap((u) =>
    resolvePageUrls(u, SECONDARY_PATHS)
  );
  const sitemapUrls = await fetchSitemapContactUrls(baseUrl);

  const allStaticUrls = [
    ...new Set([...priorityUrls, ...secondaryUrls, ...sitemapUrls]),
  ];

  const priority = await scanPagesInParallel(allStaticUrls);
  if (priority.email) {
    return {
      email: priority.email,
      contactFormDetected: priority.hasContactForm,
      contactPageUrl: priority.pageUrl,
    };
  }

  const crawled = await crawlContactPages(
    baseUrl,
    new Set(allStaticUrls)
  );
  if (crawled.email) {
    return {
      email: crawled.email,
      contactFormDetected: crawled.hasContactForm,
      contactPageUrl: crawled.pageUrl,
    };
  }

  const headlessUrls = [
    baseUrl,
    ...urlVariants.filter((u) => u !== baseUrl),
    ...resolvePageUrls(baseUrl, PRIORITY_PATHS),
    ...sitemapUrls,
    ...secondaryUrls.slice(0, 4),
  ];
  const headless = await tryHeadlessFallback(headlessUrls, siteHostname);
  if (headless.email) {
    return {
      email: headless.email,
      contactFormDetected: headless.hasContactForm,
      contactPageUrl: headless.pageUrl,
    };
  }

  const contactFormDetected =
    priority.hasContactForm || crawled.hasContactForm;
  const contactPageUrl = priority.pageUrl ?? crawled.pageUrl ?? null;

  return {
    email: null,
    contactFormDetected,
    contactPageUrl,
  };
}
