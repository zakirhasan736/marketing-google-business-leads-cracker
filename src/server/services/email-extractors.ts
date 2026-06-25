import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const OBFUSCATED_PATTERNS = [
  /([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|&#64;|@|\s+at\s+)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|&#46;|\.|\s+dot\s+)\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)\s*\[dot\]\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*(?:&#x40;|&commat;)\s*([a-zA-Z0-9.-]+)\s*(?:&#x2e;|&period;)\s*([a-zA-Z]{2,})/gi,
];

const CONTACT_REGION_SELECTORS = [
  "footer",
  "header",
  "nav",
  '[role="navigation"]',
  '[role="contentinfo"]',
  "aside",
  ".footer",
  ".header",
  ".nav",
  ".navbar",
  ".navigation",
  ".sidebar",
  ".side-bar",
  ".banner",
  ".top-bar",
  ".site-footer",
  ".site-header",
  "#footer",
  "#header",
  "#nav",
  "#navigation",
  "#contact",
  ".contact",
  ".contact-info",
  ".contact-details",
  ".contact-us",
  '[class*="footer"]',
  '[class*="header"]',
  '[class*="contact"]',
  '[class*="sidebar"]',
  '[id*="footer"]',
  '[id*="contact"]',
  '[id*="header"]',
];

const BLOCKED_EMAIL_PATTERNS = [
  /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|webmaster@)/i,
  /@(example\.(com|org|net)|email\.com|domain\.com|yoursite\.com|sentry\.io|wixpress\.com|facebook\.com|google\.com|schema\.org|w3\.org|cloudflare\.com|gravatar\.com|placeholder\.com)/i,
  /^(test|demo|sample|user|name|you|your|email|username)@/i,
  /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i,
];

const PREFERRED_LOCAL_PARTS = [
  "info",
  "contact",
  "hello",
  "sales",
  "support",
  "admin",
  "office",
  "inquiries",
  "enquiries",
  "mail",
  "team",
  "service",
];

export function decodeCloudflareEmail(encoded: string): string | null {
  if (!encoded || encoded.length < 4) return null;
  try {
    const key = parseInt(encoded.slice(0, 2), 16);
    let email = "";
    for (let i = 2; i < encoded.length; i += 2) {
      email += String.fromCharCode(parseInt(encoded.slice(i, i + 2), 16) ^ key);
    }
    return isValidBusinessEmail(email) ? email : null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&commat;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function decodeBase64Email(encoded: string): string | null {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const emails = collectFromText(decoded);
    return emails.find(isValidBusinessEmail) ?? null;
  } catch {
    return null;
  }
}

function decodeRot13(text: string): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
  });
}

export function isValidBusinessEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@") || normalized.length > 254) return false;
  return !BLOCKED_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function pickBestEmail(
  candidates: string[],
  siteHostname?: string
): string | null {
  const unique = [
    ...new Set(
      candidates
        .map((e) => e.trim().toLowerCase())
        .filter(isValidBusinessEmail)
    ),
  ];

  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];

  const siteDomain = siteHostname?.replace(/^www\./, "").toLowerCase();

  const scored = unique.map((email) => {
    let score = 0;
    const [local, domain] = email.split("@");

    if (siteDomain && (domain === siteDomain || domain.endsWith(`.${siteDomain}`))) {
      score += 50;
    }

    if (PREFERRED_LOCAL_PARTS.includes(local)) {
      score += 30;
    }

    if (local.length <= 12) score += 5;
    if (local.includes("newsletter") || local.includes("subscribe")) score -= 20;

    return { email, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].email;
}

function collectFromText(text: string): string[] {
  const found: string[] = [];
  const decoded = decodeHtmlEntities(text);

  for (const source of [text, decoded]) {
    for (const match of source.matchAll(EMAIL_REGEX)) {
      found.push(match[0]);
    }

    for (const pattern of OBFUSCATED_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        found.push(`${match[1]}@${match[2]}.${match[3]}`);
      }
    }
  }

  return found;
}

function extractFromHtmlComments(html: string): string[] {
  const found: string[] = [];
  const commentRegex = /<!--([\s\S]*?)-->/g;
  let match;
  while ((match = commentRegex.exec(html)) !== null) {
    found.push(...collectFromText(match[1]));
  }
  return found;
}

function extractFromScripts(html: string): string[] {
  const found: string[] = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const script = match[1];

    found.push(...collectFromText(script));

    const concatPattern =
      /['"]([^'"]+)['"]\s*\+\s*['"]@['"]\s*\+\s*['"]([^'"]+)['"]/gi;
    concatPattern.lastIndex = 0;
    let concatMatch;
    while ((concatMatch = concatPattern.exec(script)) !== null) {
      found.push(`${concatMatch[1]}@${concatMatch[2]}`);
    }

    const reverseConcat =
      /['"]([^'"]+\.[a-z]{2,})['"]\s*\+\s*['"]@['"]\s*\+\s*['"]([^'"]+)['"]/gi;
    reverseConcat.lastIndex = 0;
    let revMatch;
    while ((revMatch = reverseConcat.exec(script)) !== null) {
      found.push(`${revMatch[2]}@${revMatch[1]}`);
    }

    const atobPattern = /atob\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/gi;
    atobPattern.lastIndex = 0;
    let atobMatch;
    while ((atobMatch = atobPattern.exec(script)) !== null) {
      const decoded = decodeBase64Email(atobMatch[1]);
      if (decoded) found.push(decoded);
      else found.push(...collectFromText(atobMatch[1]));
    }

    const mailtoInJs = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    mailtoInJs.lastIndex = 0;
    let mailtoMatch;
    while ((mailtoMatch = mailtoInJs.exec(script)) !== null) {
      found.push(mailtoMatch[1]);
    }

    const rot13Candidates = script.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (!rot13Candidates?.length) {
      const rot13Decoded = decodeRot13(script);
      found.push(...collectFromText(rot13Decoded));
    }
  }

  return found;
}

function extractFromContactRegions($: cheerio.CheerioAPI): string[] {
  const found: string[] = [];

  for (const selector of CONTACT_REGION_SELECTORS) {
    try {
      $(selector).each((_, el) => {
        const regionHtml = $(el).html() ?? "";
        const regionText = $(el).text();
        found.push(...collectFromText(regionHtml));
        found.push(...collectFromText(regionText));
        found.push(...extractFromSplitElements($, el as Element));
        found.push(...extractFromAttributesInElement($, el as Element));
      });
    } catch {
      // invalid selector — skip
    }
  }

  return found;
}

function extractFromSplitElements(
  $: cheerio.CheerioAPI,
  root?: AnyNode
): string[] {
  const found: string[] = [];
  const scope = root ? $(root) : $("body");

  scope.find("a, span, p, div, li, td, strong, em, b, i").each((_, el) => {
    const directChildren = $(el).children();
    if (directChildren.length < 2) return;

    const joined = directChildren
      .map((_, child) => $(child).text().trim())
      .get()
      .join("");

    if (joined.includes("@")) {
      found.push(...collectFromText(joined.replace(/\s+/g, "")));
    }

    const joinedWithSpaces = directChildren
      .map((_, child) => $(child).text().trim())
      .get()
      .join(" ");
    if (joinedWithSpaces.includes("@") || joinedWithSpaces.includes(" at ")) {
      found.push(...collectFromText(joinedWithSpaces));
    }
  });

  $('[class*="email"], [class*="mail"], [id*="email"], [id*="mail"]').each(
    (_, el) => {
      const text = $(el).text().replace(/\s+/g, "");
      if (text.includes("@")) {
        found.push(...collectFromText(text));
      }
      found.push(...extractFromAttributesInElement($, el));
    }
  );

  return found;
}

function extractFromAttributesInElement(
  $: cheerio.CheerioAPI,
  el: AnyNode
): string[] {
  const found: string[] = [];
  const attrs = [
    $(el).attr("title"),
    $(el).attr("aria-label"),
    $(el).attr("alt"),
    $(el).attr("data-email"),
    $(el).attr("data-mail"),
    $(el).attr("data-contact-email"),
    $(el).attr("data-enc-email"),
    $(el).attr("data-cfemail"),
    $(el).attr("onclick"),
    $(el).attr("href"),
    $(el).attr("content"),
  ];

  for (const attr of attrs) {
    if (!attr) continue;
    found.push(...collectFromText(attr));

    if (attr.includes("cfemail") || /^[0-9a-f]{4,}$/i.test(attr)) {
      const decoded = decodeCloudflareEmail(attr.replace(/.*#/, ""));
      if (decoded) found.push(decoded);
    }

    try {
      const decoded = decodeURIComponent(attr);
      found.push(...collectFromText(decoded));
    } catch {
      // not URL-encoded
    }
  }

  return found;
}

function extractFromAttributes($: cheerio.CheerioAPI): string[] {
  const found: string[] = [];

  $("[title], [aria-label], [alt], [onclick], [data-enc-email]").each(
    (_, el) => {
      found.push(...extractFromAttributesInElement($, el));
    }
  );

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("mailto:")) return;

    try {
      const decoded = decodeURIComponent(href);
      found.push(...collectFromText(decoded));
    } catch {
      found.push(...collectFromText(href));
    }
  });

  return found;
}

function extractFromJsonLd(html: string): string[] {
  const found: string[] = [];
  const jsonLdRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      walkJsonForEmails(data, found);
    } catch {
      // invalid JSON-LD block
    }
  }

  return found;
}

function walkJsonForEmails(value: unknown, found: string[]): void {
  if (!value) return;

  if (typeof value === "string") {
    found.push(...collectFromText(value));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkJsonForEmails(item, found));
    return;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (typeof obj.email === "string") {
      found.push(obj.email);
    }

    if (obj.contactPoint) {
      walkJsonForEmails(obj.contactPoint, found);
    }

    Object.values(obj).forEach((v) => walkJsonForEmails(v, found));
  }
}

function extractFromForms($: cheerio.CheerioAPI): string[] {
  const found: string[] = [];

  $("form").each((_, form) => {
    const action = $(form).attr("action") ?? "";
    if (action.startsWith("mailto:")) {
      found.push(action.replace("mailto:", "").split("?")[0]);
    }

    if (action.includes("formspree.io")) {
      found.push(...collectFromText($(form).html() ?? ""));
    }

    $(form)
      .find('input[type="hidden"], input[type="email"]')
      .each((_, input) => {
        const name = ($(input).attr("name") ?? "").toLowerCase();
        const value = $(input).attr("value") ?? "";
        if (
          value.includes("@") &&
          (name.includes("email") ||
            name.includes("recipient") ||
            name.includes("_to") ||
            name.includes("to") ||
            name.includes("admin"))
        ) {
          found.push(...collectFromText(value));
        }
      });

    const formText = $(form).text();
    found.push(...collectFromText(formText));

    $(form)
      .find("[placeholder], [aria-label], [data-email], [data-mail]")
      .each((_, el) => {
        const attrs = [
          $(el).attr("placeholder"),
          $(el).attr("aria-label"),
          $(el).attr("data-email"),
          $(el).attr("data-mail"),
        ];
        attrs.forEach((attr) => {
          if (attr) found.push(...collectFromText(attr));
        });
      });
  });

  return found;
}

function extractFromCloudflare($: cheerio.CheerioAPI): string[] {
  const found: string[] = [];

  $("a.__cf_email__, span.__cf_email__, [data-cfemail]").each((_, el) => {
    const encoded =
      $(el).attr("data-cfemail") ??
      $(el).attr("href")?.replace(/.*#/, "") ??
      "";
    const decoded = decodeCloudflareEmail(encoded);
    if (decoded) found.push(decoded);
  });

  $('[href*="/cdn-cgi/l/email-protection"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const hash = href.split("#")[1];
    const decoded = decodeCloudflareEmail(hash ?? "");
    if (decoded) found.push(decoded);
  });

  $("[data-cfemail]").each((_, el) => {
    const encoded = $(el).attr("data-cfemail") ?? "";
    const decoded = decodeCloudflareEmail(encoded);
    if (decoded) found.push(decoded);
  });

  return found;
}

function extractFromMicrodata($: cheerio.CheerioAPI): string[] {
  const found: string[] = [];

  $('[itemprop="email"]').each((_, el) => {
    const content = $(el).attr("content") ?? $(el).text();
    found.push(...collectFromText(content));
  });

  return found;
}

function extractFromMeta($: cheerio.CheerioAPI): string[] {
  const found: string[] = [];

  $('meta[name*="email" i], meta[property*="email" i]').each((_, el) => {
    const content = $(el).attr("content") ?? "";
    found.push(...collectFromText(content));
  });

  return found;
}

function boostRegionCandidates(regionEmails: string[]): string[] {
  return regionEmails.flatMap((email) => [email, email, email]);
}

export function extractEmailsFromHtml(
  html: string,
  siteHostname?: string
): { email: string | null; hasContactForm: boolean } {
  const $ = cheerio.load(html);
  const candidates: string[] = [];

  $('a[href^="mailto:"]').each((_, link) => {
    const href = $(link).attr("href")?.replace("mailto:", "").split("?")[0];
    if (href) {
      try {
        candidates.push(decodeURIComponent(href));
      } catch {
        candidates.push(href);
      }
    }
  });

  const regionEmails = extractFromContactRegions($);
  candidates.push(...boostRegionCandidates(regionEmails));

  candidates.push(...extractFromCloudflare($));
  candidates.push(...extractFromJsonLd(html));
  candidates.push(...extractFromForms($));
  candidates.push(...extractFromMicrodata($));
  candidates.push(...extractFromMeta($));
  candidates.push(...extractFromAttributes($));
  candidates.push(...extractFromSplitElements($));
  candidates.push(...extractFromScripts(html));
  candidates.push(...extractFromHtmlComments(html));

  $("[data-email], [data-mail], [data-contact-email]").each((_, el) => {
    const attrs = [
      $(el).attr("data-email"),
      $(el).attr("data-mail"),
      $(el).attr("data-contact-email"),
    ];
    attrs.forEach((attr) => {
      if (attr) candidates.push(...collectFromText(attr));
    });
  });

  candidates.push(...collectFromText(html));

  const hasContactForm =
    $("form").length > 0 &&
    ($("form").text().toLowerCase().includes("contact") ||
      $("form")
        .find('input[type="email"], textarea, [name*="message" i]')
        .length > 0);

  return {
    email: pickBestEmail(candidates, siteHostname),
    hasContactForm,
  };
}
