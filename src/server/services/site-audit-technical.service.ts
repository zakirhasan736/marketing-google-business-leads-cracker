import * as cheerio from "cheerio";
import type {
  AiBotStatus,
  AuditFinding,
  AuditIssueRow,
  CrawlBreakdown,
  CrawledPageSummary,
  HeadlessRenderReport,
  TechnicalSeoReport,
} from "@/lib/types/site-audit";
import { runHeadlessRenderCheck } from "@/server/services/headless-render.service";

const MAX_CRAWL_PAGES = 17;
const FETCH_TIMEOUT_MS = 12000;
const TITLE_MAX_LENGTH = 60;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const AI_BOT_UA = "GPTBot/1.0 (+https://openai.com/gptbot)";

const AI_BOT_CONFIGS = [
  {
    id: "chatgpt-user",
    name: "ChatGPT-User",
    robotsKey: "chatgpt-user",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  },
  {
    id: "oai-searchbot",
    name: "OAI-SearchBot",
    robotsKey: "oai-searchbot",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
  },
  {
    id: "googlebot",
    name: "Googlebot",
    robotsKey: "googlebot",
    ua: GOOGLEBOT_UA,
  },
  {
    id: "google-extended",
    name: "Google-Extended",
    robotsKey: "google-extended",
    ua: "Mozilla/5.0 (compatible; Google-Extended; +http://www.google.com/bot.html)",
  },
  {
    id: "gptbot",
    name: "GPTBot",
    robotsKey: "gptbot",
    ua: AI_BOT_UA,
  },
] as const;

const PRIORITY_PATHS = [
  "/about",
  "/about-us",
  "/services",
  "/contact",
  "/contact-us",
  "/pricing",
  "/blog",
];

interface FetchResult {
  text: string;
  status: number;
  finalUrl: string;
  redirected: boolean;
}

async function fetchText(
  url: string,
  userAgent = CHROME_UA,
  redirect: RequestRedirect = "follow"
): Promise<FetchResult | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,text/plain,application/xml,*/*",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") ?? url;
      return {
        text: "",
        status: response.status,
        finalUrl: location,
        redirected: true,
      };
    }

    const text = await response.text();
    return {
      text,
      status: response.status,
      finalUrl: response.url || url,
      redirected: false,
    };
  } catch {
    return null;
  }
}

function countVisibleWords(html: string): number {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return text.split(/\s+/).filter(Boolean).length;
}

function parseRobotsTxt(content: string): {
  disallowRules: Map<string, string[]>;
  sitemapUrls: string[];
  issues: string[];
} {
  const lines = content.split(/\r?\n/);
  let activeAgents = new Set<string>();
  const disallowRules = new Map<string, string[]>();
  const sitemapUrls: string[] = [];
  const issues: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const agentMatch = line.match(/^User-agent:\s*(.+)$/i);
    if (agentMatch) {
      activeAgents = new Set([agentMatch[1]!.trim().toLowerCase()]);
      continue;
    }

    const disallowMatch = line.match(/^Disallow:\s*(.*)$/i);
    if (disallowMatch) {
      for (const agent of activeAgents) {
        const list = disallowRules.get(agent) ?? [];
        list.push(disallowMatch[1]!.trim());
        disallowRules.set(agent, list);
      }
      continue;
    }

    const sitemapMatch = line.match(/^Sitemap:\s*(.+)$/i);
    if (sitemapMatch) {
      sitemapUrls.push(sitemapMatch[1]!.trim());
    }
  }

  if (isAgentBlocked(disallowRules, "googlebot")) {
    issues.push("robots.txt blocks Googlebot from the entire site");
  }
  if (isAgentBlocked(disallowRules, "gptbot")) {
    issues.push("robots.txt blocks AI crawlers (e.g. GPTBot)");
  }

  return { disallowRules, sitemapUrls, issues };
}

function isAgentBlocked(
  disallowRules: Map<string, string[]>,
  agent: string
): boolean {
  const key = agent.toLowerCase();
  const rules = [
    ...(disallowRules.get("*") ?? []),
    ...(disallowRules.get(key) ?? []),
  ];
  return rules.some((rule) => rule === "/" || rule === "/*");
}

function computeSemanticHtmlScore(html: string): number {
  const $ = cheerio.load(html);
  const semantic = $(
    "article, nav, main, section, header, footer, aside, figure"
  ).length;
  const divs = $("div").length;
  if (semantic + divs === 0) return 50;
  return Math.round((semantic / (semantic + divs)) * 100);
}

async function checkSsl(siteUrl: string): Promise<TechnicalSeoReport["ssl"]> {
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol === "https:") {
      return {
        secure: true,
        finalProtocol: "https",
        note: "Site loads over HTTPS",
      };
    }

    const httpUrl = siteUrl.replace(/^https:/i, "http:");
    const res = await fetch(httpUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const secure = (res.url || httpUrl).startsWith("https://");
    return {
      secure,
      finalProtocol: secure ? "https" : "http",
      note: secure
        ? "HTTP redirects to HTTPS"
        : "Site not using HTTPS — hurts rankings and trust",
    };
  } catch {
    return {
      secure: siteUrl.startsWith("https://"),
      finalProtocol: siteUrl.startsWith("https://") ? "https" : "http",
      note: "Could not verify SSL redirect",
    };
  }
}

async function checkRobotsTxt(
  origin: string
): Promise<TechnicalSeoReport["robotsTxt"] & { disallowRules?: Map<string, string[]> }> {
  const robotsUrl = `${origin}/robots.txt`;
  const fetched = await fetchText(robotsUrl);
  if (!fetched || fetched.status >= 400) {
    return {
      found: false,
      url: robotsUrl,
      allowsGooglebot: null,
      allowsAiBots: null,
      hasSitemapDirective: false,
      issues: ["No robots.txt found"],
      disallowRules: new Map(),
    };
  }

  const parsed = parseRobotsTxt(fetched.text);
  return {
    found: true,
    url: robotsUrl,
    allowsGooglebot: !isAgentBlocked(parsed.disallowRules, "googlebot"),
    allowsAiBots: !isAgentBlocked(parsed.disallowRules, "gptbot"),
    hasSitemapDirective: parsed.sitemapUrls.length > 0,
    sitemapUrls: parsed.sitemapUrls,
    issues: parsed.issues,
    disallowRules: parsed.disallowRules,
  };
}

async function checkLlmsTxt(origin: string): Promise<{ found: boolean; url: string }> {
  const llmsUrl = `${origin}/llms.txt`;
  const fetched = await fetchText(llmsUrl);
  const found = Boolean(fetched && fetched.status >= 200 && fetched.status < 300 && fetched.text.trim().length > 0);
  return { found, url: llmsUrl };
}

async function checkSitemap(
  origin: string,
  robotsSitemaps: string[]
): Promise<TechnicalSeoReport["sitemap"]> {
  const candidates = [
    ...robotsSitemaps,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    const fetched = await fetchText(candidate);
    if (!fetched || fetched.status >= 400) continue;

    const locMatches = fetched.text.match(/<loc>\s*([^<]+)\s*<\/loc>/gi) ?? [];
    const urls = locMatches
      .map((m) => m.replace(/<\/?loc>/gi, "").trim())
      .filter(Boolean);

    if (urls.length > 0 || fetched.text.includes("<urlset")) {
      return {
        found: true,
        url: fetched.finalUrl,
        urlCount: urls.length,
        sampleUrls: urls.slice(0, 5),
      };
    }
  }

  return {
    found: false,
    url: null,
    urlCount: 0,
    sampleUrls: [],
  };
}

function detectRenderingMode(params: {
  chromeWords: number;
  googlebotWords: number;
  aiWords: number;
  scriptCount: number;
  chromeHtml?: string | null;
}): TechnicalSeoReport["rendering"] {
  const { chromeWords, googlebotWords, aiWords, scriptCount, chromeHtml } = params;
  const botRatio =
    chromeWords > 0 ? googlebotWords / chromeWords : googlebotWords > 0 ? 1 : 0;
  const aiRatio = chromeWords > 0 ? aiWords / chromeWords : aiWords > 0 ? 1 : 0;

  let mode: TechnicalSeoReport["rendering"]["mode"] = "unknown";
  let summary = "";
  const signals: TechnicalSeoReport["rendering"]["signals"] = [];

  const pushSignal = (s: (typeof signals)[number]) => signals.push(s);

  pushSignal({
    id: "browser-words",
    label: "Browser HTML word count",
    value: String(chromeWords),
    impact: chromeWords >= 120 ? "positive" : chromeWords >= 60 ? "neutral" : "negative",
  });
  pushSignal({
    id: "googlebot-ratio",
    label: "Googlebot content parity",
    value: `${Math.round(botRatio * 100)}%`,
    impact: botRatio >= 0.7 ? "positive" : botRatio >= 0.45 ? "neutral" : "negative",
  });
  pushSignal({
    id: "ai-ratio",
    label: "AI crawler content parity",
    value: `${Math.round(aiRatio * 100)}%`,
    impact: aiRatio >= 0.7 ? "positive" : aiRatio >= 0.45 ? "neutral" : "negative",
  });
  pushSignal({
    id: "script-count",
    label: "Script tags on homepage",
    value: String(scriptCount),
    impact: scriptCount <= 8 ? "positive" : scriptCount <= 15 ? "neutral" : "negative",
  });

  if (chromeHtml) {
    const $ = cheerio.load(chromeHtml);
    const hasNextData = $("#__NEXT_DATA__").length > 0;
    const hasNuxt = $("#__NUXT__").length > 0 || chromeHtml.includes("window.__NUXT__");
    const hasReactRoot =
      $("#root").length > 0 ||
      $("#app").length > 0 ||
      chromeHtml.includes("data-reactroot") ||
      chromeHtml.includes("react-dom");
    const hasHydrationMarkers =
      chromeHtml.includes("__NEXT_DATA__") ||
      chromeHtml.includes("hydrateRoot") ||
      chromeHtml.includes("ReactDOM.hydrate");
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const bodyTextLen = bodyText.length;
    const mainTextLen = $("main").text().replace(/\s+/g, " ").trim().length;
    const hasMeaningfulMain = mainTextLen >= 120;

    if (hasNextData) {
      pushSignal({
        id: "nextjs",
        label: "Framework marker",
        value: "Next.js detected",
        impact: hasMeaningfulMain ? "positive" : "neutral",
      });
    } else if (hasNuxt) {
      pushSignal({
        id: "nuxt",
        label: "Framework marker",
        value: "Nuxt detected",
        impact: hasMeaningfulMain ? "positive" : "neutral",
      });
    } else if (hasReactRoot) {
      pushSignal({
        id: "spa-root",
        label: "Framework marker",
        value: "SPA/React root detected",
        impact: "neutral",
      });
    }

    if (hasHydrationMarkers) {
      pushSignal({
        id: "hydration",
        label: "Hydration markers",
        value: "Present",
        impact: hasMeaningfulMain ? "positive" : "neutral",
      });
    }

    // If body text is very small but scripts are high, it's usually CSR shell.
    if (bodyTextLen < 200 && scriptCount > 12) {
      pushSignal({
        id: "thin-shell",
        label: "HTML shell",
        value: "Very little visible text with many scripts",
        impact: "negative",
      });
    }

    if (hasMeaningfulMain) {
      pushSignal({
        id: "main-content",
        label: "Main content in HTML",
        value: "Yes",
        impact: "positive",
      });
    } else {
      pushSignal({
        id: "main-content",
        label: "Main content in HTML",
        value: "Not detected",
        impact: "negative",
      });
    }
  }

  if (chromeWords >= 200 && botRatio >= 0.7) {
    mode = scriptCount > 15 ? "hybrid" : "ssr";
    summary =
      mode === "ssr"
        ? "Server-side rendering — HTML contains content Googlebot can read"
        : "Hybrid rendering — core content in HTML with significant JavaScript";
  } else if (chromeWords >= 80 && botRatio < 0.35) {
    mode = "csr";
    summary =
      "Client-side rendering (CSR) — bots see much less text than browsers; SEO risk";
  } else if (chromeWords < 80 && scriptCount > 5) {
    mode = "csr";
    summary = "Thin HTML shell with heavy JavaScript — page may not rank well";
  } else {
    mode = "hybrid";
    summary = "Mixed rendering — verify important content exists in raw HTML";
  }

  if (aiRatio < 0.35 && chromeWords > 100) {
    summary += ". AI crawlers also see reduced content";
  }

  // Confidence: based on the clarity of signals and parity ratios.
  let confidence = 55;
  if (mode === "ssr") confidence += 18;
  if (mode === "csr") confidence += 18;
  if (botRatio >= 0.8 || botRatio <= 0.25) confidence += 12;
  if (aiRatio >= 0.8 || aiRatio <= 0.25) confidence += 6;
  if (chromeWords < 60 || chromeWords > 400) confidence += 5;
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    mode,
    chromeWordCount: chromeWords,
    googlebotWordCount: googlebotWords,
    aiBotWordCount: aiWords,
    scriptCount,
    botContentRatio: Math.round(botRatio * 100),
    aiContentRatio: Math.round(aiRatio * 100),
    confidence,
    signals,
    summary,
  };
}

function applyHeadlessRenderingRefinement(
  rendering: TechnicalSeoReport["rendering"],
  headless: HeadlessRenderReport
): TechnicalSeoReport["rendering"] {
  if (!headless.enabled) return rendering;

  const signals = [...(rendering.signals ?? [])];

  if (headless.success) {
    signals.push({
      id: "headless-words",
      label: "Headless rendered words",
      value: String(headless.renderedWordCount),
      impact:
        headless.renderedWordCount >= rendering.chromeWordCount * 1.5
          ? "negative"
          : headless.renderedWordCount >= rendering.chromeWordCount * 0.85
            ? "positive"
            : "neutral",
    });
    signals.push({
      id: "headless-gain",
      label: "JS content gain",
      value: `${headless.contentGainPercent}% of raw HTML`,
      impact:
        headless.contentGainPercent >= 200
          ? "negative"
          : headless.contentGainPercent <= 120
            ? "positive"
            : "neutral",
    });
    signals.push({
      id: "headless-time",
      label: "Headless render time",
      value: `${Math.round(headless.renderTimeMs / 1000)}s`,
      impact: "neutral",
    });
  } else {
    signals.push({
      id: "headless-failed",
      label: "Headless render check",
      value: headless.error ?? "Failed",
      impact: "neutral",
    });
  }

  if (!headless.success) {
    return { ...rendering, headless, signals };
  }

  let mode = rendering.mode;
  let confidence = rendering.confidence;
  let summary = rendering.summary;

  if (headless.verdict === "csr_confirmed") {
    mode = "csr";
    confidence = Math.max(confidence, 92);
    summary = headless.summary;
  } else if (headless.verdict === "ssr_confirmed") {
    mode = "ssr";
    confidence = Math.max(confidence, 94);
    summary = headless.summary;
  } else if (headless.verdict === "hybrid_confirmed") {
    mode = "hybrid";
    confidence = Math.max(confidence, 88);
    summary = headless.summary;
  } else {
    confidence = Math.min(confidence, 75);
    summary = `${rendering.summary} ${headless.summary}`;
  }

  return {
    ...rendering,
    mode,
    confidence,
    summary,
    signals,
    headless,
  };
}

function collectInternalLinks(baseUrl: string, homepageHtml: string): string[] {
  const base = new URL(baseUrl);
  const $ = cheerio.load(homepageHtml);
  const links = new Set<string>();

  const add = (href: string) => {
    try {
      const full = new URL(href, baseUrl);
      if (full.hostname !== base.hostname) return;
      if (!["http:", "https:"].includes(full.protocol)) return;
      const clean =
        `${full.origin}${full.pathname}`.replace(/\/$/, "") || full.origin;
      links.add(clean);
    } catch {
      // ignore
    }
  };

  for (const path of PRIORITY_PATHS) {
    add(new URL(path, baseUrl).toString().replace(/\/$/, "") || baseUrl);
  }

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) add(href);
  });

  return [...links].filter((l) => l !== base.origin && l !== `${base.origin}/`);
}

function categorizePage(
  page: Omit<CrawledPageSummary, "category">
): CrawledPageSummary["category"] {
  if (page.status === 403 || page.status === 451) return "blocked";
  if (page.status >= 300 && page.status < 400) return "redirect";
  if (page.status >= 400 || page.status === 0) return "broken";
  if (page.issue) return "haveIssues";
  return "healthy";
}

function parsePageSummary(
  url: string,
  status: number,
  html: string,
  redirected = false
): CrawledPageSummary {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  const titleTooLong = title ? title.length > TITLE_MAX_LENGTH : false;
  const hasH1 = $("h1").length > 0;
  const wordCount = html ? countVisibleWords(html) : 0;
  let issue: string | null = null;

  if (redirected) issue = `Redirect (${status})`;
  else if (status >= 400) issue = `HTTP ${status}`;
  else if (!title) issue = "Missing title";
  else if (!hasH1) issue = "Missing H1";
  else if (titleTooLong) issue = "Long title element";
  else if (wordCount < 100) issue = "Low word count";

  const base = { url, status, title, wordCount, hasH1, issue, titleTooLong };
  return { ...base, category: categorizePage(base) };
}

function buildCrawlBreakdown(pages: CrawledPageSummary[]): CrawlBreakdown {
  const breakdown: CrawlBreakdown = {
    total: pages.length,
    healthy: 0,
    broken: 0,
    haveIssues: 0,
    redirects: 0,
    blocked: 0,
  };

  for (const page of pages) {
    switch (page.category) {
      case "healthy":
        breakdown.healthy++;
        break;
      case "broken":
        breakdown.broken++;
        break;
      case "haveIssues":
        breakdown.haveIssues++;
        break;
      case "redirect":
        breakdown.redirects++;
        break;
      case "blocked":
        breakdown.blocked++;
        break;
    }
  }

  return breakdown;
}

async function crawlPages(
  siteUrl: string,
  homepageHtml: string
): Promise<CrawledPageSummary[]> {
  const candidates = collectInternalLinks(siteUrl, homepageHtml).slice(
    0,
    MAX_CRAWL_PAGES - 1
  );
  const pages: CrawledPageSummary[] = [];

  pages.push(parsePageSummary(siteUrl, 200, homepageHtml));

  for (const pageUrl of candidates) {
    if (pages.length >= MAX_CRAWL_PAGES) break;

    const fetched = await fetchText(pageUrl, CHROME_UA, "manual");
    if (!fetched) {
      pages.push({
        url: pageUrl,
        status: 0,
        title: null,
        wordCount: 0,
        hasH1: false,
        issue: "Could not fetch",
        category: "broken",
      });
      continue;
    }

    if (fetched.redirected) {
      pages.push(
        parsePageSummary(fetched.finalUrl, fetched.status, "", true)
      );
      continue;
    }

    if (!fetched.text || fetched.status >= 400) {
      pages.push({
        url: pageUrl,
        status: fetched.status,
        title: null,
        wordCount: 0,
        hasH1: false,
        issue: `HTTP ${fetched.status}`,
        category: fetched.status === 403 ? "blocked" : "broken",
      });
      continue;
    }

    pages.push(
      parsePageSummary(fetched.finalUrl, fetched.status, fetched.text)
    );
  }

  return pages;
}

function buildIssueInventory(params: {
  pages: CrawledPageSummary[];
  llmsTxtFound: boolean;
  semanticHtmlScore: number;
  rendering: TechnicalSeoReport["rendering"];
  ssl: TechnicalSeoReport["ssl"];
  sitemap: TechnicalSeoReport["sitemap"];
}): AuditIssueRow[] {
  const { pages, llmsTxtFound, semanticHtmlScore, rendering, ssl, sitemap } =
    params;
  const issues: AuditIssueRow[] = [];

  const missingH1 = pages.filter((p) => !p.hasH1 && p.status < 400).length;
  if (missingH1 > 0) {
    issues.push({
      id: "missing-h1",
      title: "Missing h1",
      pagesAffected: missingH1,
      severity: "warning",
      howToFix:
        "Add a single descriptive H1 heading on each page that summarizes the main topic.",
    });
  }

  const longTitles = pages.filter((p) => p.titleTooLong).length;
  if (longTitles > 0) {
    issues.push({
      id: "long-title",
      title: "Long title element",
      pagesAffected: longTitles,
      severity: "warning",
      howToFix: `Keep page titles under ${TITLE_MAX_LENGTH} characters so they display fully in search results.`,
    });
  }

  const thinContent = pages.filter(
    (p) => p.wordCount < 100 && p.status < 400 && !p.issue?.includes("Redirect")
  ).length;
  if (thinContent > 0) {
    issues.push({
      id: "low-word-count",
      title: "Low word count",
      pagesAffected: thinContent,
      severity: "warning",
      howToFix:
        "Expand page content with useful, unique text (aim for 300+ words on key landing pages).",
    });
  }

  if (!llmsTxtFound) {
    issues.push({
      id: "llms-txt",
      title: "llms.txt not found",
      pagesAffected: 1,
      severity: "warning",
      howToFix:
        "Publish /llms.txt at your site root with guidance for AI crawlers on what content to index.",
      tag: "AI Search",
    });
  }

  if (semanticHtmlScore < 40) {
    issues.push({
      id: "semantic-html",
      title: "Low Semantic HTML usage",
      pagesAffected: 1,
      severity: "warning",
      howToFix:
        "Use semantic elements (main, nav, section, article, header, footer) instead of nested divs.",
      tag: "AI Search",
    });
  }

  if (rendering.mode === "csr") {
    issues.push({
      id: "csr-rendering",
      title: "Client-side rendering detected",
      pagesAffected: 1,
      severity: "error",
      howToFix:
        "Server-render critical content or use static generation so bots receive full HTML.",
      tag: "AI Search",
    });
  }

  if (!ssl.secure) {
    issues.push({
      id: "no-https",
      title: "Site not using HTTPS",
      pagesAffected: 1,
      severity: "error",
      howToFix: "Install an SSL certificate and redirect all HTTP traffic to HTTPS.",
    });
  }

  if (!sitemap.found) {
    issues.push({
      id: "no-sitemap",
      title: "XML sitemap not found",
      pagesAffected: 1,
      severity: "warning",
      howToFix: "Create sitemap.xml and reference it in robots.txt.",
    });
  }

  const broken = pages.filter((p) => p.category === "broken").length;
  if (broken > 0) {
    issues.push({
      id: "broken-pages",
      title: "Broken pages (4xx/5xx)",
      pagesAffected: broken,
      severity: "error",
      howToFix: "Fix or redirect broken URLs and update internal links.",
    });
  }

  return issues.sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

async function checkAiBots(params: {
  siteUrl: string;
  chromeWords: number;
  disallowRules: Map<string, string[]>;
}): Promise<AiBotStatus[]> {
  const { siteUrl, chromeWords, disallowRules } = params;
  const results: AiBotStatus[] = [];

  for (const bot of AI_BOT_CONFIGS) {
    const blockedByRobots = isAgentBlocked(disallowRules, bot.robotsKey);
    let contentRatio = 100;
    let status: AiBotStatus["status"] = "ok";
    let message = "All good";

    if (!blockedByRobots) {
      const fetched = await fetchText(siteUrl, bot.ua);
      if (!fetched || fetched.status >= 400) {
        status = fetched?.status === 403 ? "blocked" : "limited";
        message =
          fetched?.status === 403
            ? "Blocked by server (403)"
            : `HTTP ${fetched?.status ?? "error"} — limited access`;
        contentRatio = 0;
      } else {
        const botWords = countVisibleWords(fetched.text);
        contentRatio =
          chromeWords > 0
            ? Math.round((botWords / chromeWords) * 100)
            : botWords > 0
              ? 100
              : 0;

        if (contentRatio < 35 && chromeWords > 80) {
          status = "limited";
          message = `Sees ~${contentRatio}% of browser content`;
        }
      }
    } else {
      status = "blocked";
      message = "Blocked by robots.txt";
      contentRatio = 0;
    }

    results.push({
      id: bot.id,
      name: bot.name,
      status,
      blockedByRobots,
      contentRatio,
      message,
    });
  }

  return results;
}

function computeAiSearchHealth(params: {
  llmsTxtFound: boolean;
  semanticHtmlScore: number;
  rendering: TechnicalSeoReport["rendering"];
  aiBots: AiBotStatus[];
}): number {
  let score = 100;
  const { llmsTxtFound, semanticHtmlScore, rendering, aiBots } = params;

  if (!llmsTxtFound) score -= 12;
  if (semanticHtmlScore < 40) score -= 8;
  if (rendering.mode === "csr") score -= 22;
  else if (rendering.mode === "hybrid") score -= 8;
  if (rendering.aiContentRatio < 50 && rendering.chromeWordCount > 100) {
    score -= 10;
  }

  for (const bot of aiBots) {
    if (bot.status === "blocked") score -= 6;
    else if (bot.status === "limited") score -= 3;
  }

  return Math.max(0, Math.min(100, score));
}

function buildTechnicalFindings(report: TechnicalSeoReport): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!report.ssl.secure) {
    findings.push({
      id: "tech-ssl",
      title: "Site not fully secured with HTTPS",
      description: report.ssl.note,
      category: "seo",
      severity: "critical",
    });
  }

  if (report.robotsTxt.found && report.robotsTxt.allowsGooglebot === false) {
    findings.push({
      id: "tech-robots-google",
      title: "Googlebot blocked by robots.txt",
      description: "Search engines may not index this site.",
      category: "seo",
      severity: "critical",
    });
  }

  if (!report.sitemap.found) {
    findings.push({
      id: "tech-sitemap-missing",
      title: "No XML sitemap detected",
      description: "Add sitemap.xml to help Google discover pages.",
      category: "seo",
      severity: "warning",
    });
  }

  if (report.rendering.mode === "csr") {
    findings.push({
      id: "tech-csr",
      title: "Client-side rendering detected",
      description: report.rendering.summary,
      category: "html",
      severity: "critical",
    });
  }

  if (!report.llmsTxt.found) {
    findings.push({
      id: "tech-llms-txt",
      title: "llms.txt not found",
      description: "AI search engines use llms.txt for crawl guidance.",
      category: "seo",
      severity: "info",
    });
  }

  const brokenPages = report.crawledPages.filter((p) => p.category === "broken");
  if (brokenPages.length > 0) {
    findings.push({
      id: "tech-broken-pages",
      title: `${brokenPages.length} crawled page(s) return errors`,
      description: brokenPages.map((p) => `${p.url} (${p.status})`).join(", "),
      category: "seo",
      severity: "warning",
    });
  }

  return findings;
}

export async function runTechnicalSeoAudit(params: {
  siteUrl: string;
  homepageHtml: string | null;
  headlessRender?: boolean;
  strategy?: "mobile" | "desktop";
}): Promise<{ report: TechnicalSeoReport; findings: AuditFinding[] }> {
  const siteUrl = params.siteUrl;
  const origin = new URL(siteUrl).origin;

  const [ssl, robotsTxtRaw, llmsTxt] = await Promise.all([
    checkSsl(siteUrl),
    checkRobotsTxt(origin),
    checkLlmsTxt(origin),
  ]);

  const disallowRules = robotsTxtRaw.disallowRules ?? new Map<string, string[]>();
  const robotsTxt: TechnicalSeoReport["robotsTxt"] = {
    found: robotsTxtRaw.found,
    url: robotsTxtRaw.url,
    allowsGooglebot: robotsTxtRaw.allowsGooglebot,
    allowsAiBots: robotsTxtRaw.allowsAiBots,
    hasSitemapDirective: robotsTxtRaw.hasSitemapDirective,
    sitemapUrls: robotsTxtRaw.sitemapUrls,
    issues: robotsTxtRaw.issues,
  };

  const sitemap = await checkSitemap(origin, robotsTxt.sitemapUrls ?? []);

  let chromeWords = 0;
  let googlebotWords = 0;
  let aiWords = 0;
  let scriptCount = 0;
  let homepageHtml = params.homepageHtml;
  let semanticHtmlScore = 50;

  if (!homepageHtml) {
    const fetched = await fetchText(siteUrl);
    homepageHtml = fetched?.text ?? null;
  }

  if (homepageHtml) {
    chromeWords = countVisibleWords(homepageHtml);
    scriptCount = homepageHtml.match(/<script/gi)?.length ?? 0;
    semanticHtmlScore = computeSemanticHtmlScore(homepageHtml);

    const [googleFetch, aiFetch] = await Promise.all([
      fetchText(siteUrl, GOOGLEBOT_UA),
      fetchText(siteUrl, AI_BOT_UA),
    ]);

    googlebotWords = googleFetch?.text
      ? countVisibleWords(googleFetch.text)
      : 0;
    aiWords = aiFetch?.text ? countVisibleWords(aiFetch.text) : 0;
  }

  const rendering = detectRenderingMode({
    chromeWords,
    googlebotWords,
    aiWords,
    scriptCount,
    chromeHtml: homepageHtml,
  });

  let headless: HeadlessRenderReport | null = null;
  if (params.headlessRender) {
    headless = await runHeadlessRenderCheck({
      url: siteUrl,
      strategy: params.strategy ?? "mobile",
      rawWordCount: chromeWords,
    });
  }

  const refinedRendering = headless
    ? applyHeadlessRenderingRefinement(rendering, headless)
    : rendering;

  const aiBots = await checkAiBots({
    siteUrl,
    chromeWords,
    disallowRules,
  });

  const crawledPages = homepageHtml
    ? await crawlPages(siteUrl, homepageHtml)
    : [];

  const crawlBreakdown = buildCrawlBreakdown(crawledPages);

  const issueInventory = buildIssueInventory({
    pages: crawledPages,
    llmsTxtFound: llmsTxt.found,
    semanticHtmlScore,
    rendering: refinedRendering,
    ssl,
    sitemap,
  });

  const aiSearchHealth = computeAiSearchHealth({
    llmsTxtFound: llmsTxt.found,
    semanticHtmlScore,
    rendering: refinedRendering,
    aiBots,
  });

  const botNotes: string[] = [];
  const blockedBots = aiBots.filter((b) => b.status === "blocked");
  const limitedBots = aiBots.filter((b) => b.status === "limited");

  if (blockedBots.length > 0) {
    botNotes.push(
      `Blocked for: ${blockedBots.map((b) => b.name).join(", ")}`
    );
  }
  if (limitedBots.length > 0) {
    botNotes.push(
      `Limited access: ${limitedBots.map((b) => b.name).join(", ")}`
    );
  }
  if (refinedRendering.botContentRatio < 50 && chromeWords > 100) {
    botNotes.push(
      `Googlebot sees ~${refinedRendering.botContentRatio}% of browser-visible text`
    );
  }
  if (botNotes.length === 0) {
    botNotes.push("All major AI and search bots can access homepage content");
  }

  const botCompatibility: TechnicalSeoReport["botCompatibility"] = {
    googlebotAccessible:
      robotsTxt.allowsGooglebot !== false && rendering.googlebotWordCount > 0,
    aiCrawlerAccessible:
      robotsTxt.allowsAiBots !== false && rendering.aiBotWordCount > 0,
    googlebotBlockedByRobots: robotsTxt.allowsGooglebot === false,
    aiBlockedByRobots: robotsTxt.allowsAiBots === false,
    notes: botNotes,
  };

  const report: TechnicalSeoReport = {
    ssl,
    robotsTxt,
    sitemap,
    rendering: refinedRendering,
    botCompatibility,
    crawledPages,
    crawlBreakdown,
    aiBots,
    aiSearchHealth,
    llmsTxt,
    semanticHtmlScore,
    issueInventory,
  };

  const findings = buildTechnicalFindings(report);

  if (headless?.success && headless.verdict === "csr_confirmed") {
    findings.push({
      id: "tech-headless-csr",
      title: "Headless render confirms CSR",
      description: headless.summary,
      category: "html",
      severity: "critical",
    });
  }

  return { report, findings };
}
