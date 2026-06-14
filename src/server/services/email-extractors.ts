import * as cheerio from "cheerio";

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const OBFUSCATED_PATTERNS = [
  /([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|@|\s+at\s+)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\.|\s+dot\s+)\s*([a-zA-Z]{2,})/gi,
  /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)\s*\[dot\]\s*([a-zA-Z]{2,})/gi,
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

  for (const match of text.matchAll(EMAIL_REGEX)) {
    found.push(match[0]);
  }

  for (const pattern of OBFUSCATED_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      found.push(`${match[1]}@${match[2]}.${match[3]}`);
    }
  }

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

export function extractEmailsFromHtml(
  html: string,
  siteHostname?: string
): { email: string | null; hasContactForm: boolean } {
  const $ = cheerio.load(html);
  const candidates: string[] = [];

  $('a[href^="mailto:"]').each((_, link) => {
    const href = $(link).attr("href")?.replace("mailto:", "").split("?")[0];
    if (href) candidates.push(href);
  });

  candidates.push(...extractFromCloudflare($));
  candidates.push(...extractFromJsonLd(html));
  candidates.push(...extractFromForms($));
  candidates.push(...extractFromMicrodata($));
  candidates.push(...extractFromMeta($));

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
