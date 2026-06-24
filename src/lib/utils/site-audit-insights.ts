import type {
  AuditScoreCard,
  HtmlMetaReport,
  KeywordReport,
  LocalSearchRank,
  SiteAuditInsights,
} from "@/lib/types/site-audit";

export function buildSiteAuditInsights(params: {
  businessName: string;
  url: string;
  scores: AuditScoreCard;
  htmlMeta: HtmlMetaReport;
  keywords: KeywordReport;
  localRank: LocalSearchRank | null;
}): SiteAuditInsights {
  const { businessName, url, scores, htmlMeta, keywords, localRank } = params;

  const overallScore = Math.round(
    scores.performance * 0.3 +
      scores.accessibility * 0.2 +
      scores.seo * 0.3 +
      scores.bestPractices * 0.2
  );

  let grade = "F";
  let gradeLabel = "Critical — website is hurting conversions";
  let gradeColor = "#dc2626";

  if (overallScore >= 90) {
    grade = "A";
    gradeLabel = "Excellent — strong technical foundation";
    gradeColor = "#166534";
  } else if (overallScore >= 75) {
    grade = "B";
    gradeLabel = "Good — minor fixes will boost results";
    gradeColor = "#22c55e";
  } else if (overallScore >= 60) {
    grade = "C";
    gradeLabel = "Average — competitors likely outperform you";
    gradeColor = "#eab308";
  } else if (overallScore >= 45) {
    grade = "D";
    gradeLabel = "Poor — speed and SEO issues cost leads";
    gradeColor = "#f97316";
  }

  const issues: string[] = [];

  if (scores.performance < 70) {
    issues.push(`Performance score is ${scores.performance}/100 — slow sites lose 40%+ of visitors`);
  }
  if (scores.accessibility < 80) {
    issues.push(`Accessibility score is ${scores.accessibility}/100 — hurts usability and SEO`);
  }
  if (scores.seo < 80) {
    issues.push(`SEO score is ${scores.seo}/100 — Google may rank competitors higher`);
  }
  if (!htmlMeta.title) issues.push("Missing page title — essential for Google rankings");
  if (!htmlMeta.description) issues.push("Missing meta description — hurts click-through rate in search");
  if (htmlMeta.h1.length === 0) issues.push("No H1 heading found — weak on-page SEO structure");
  if (!htmlMeta.hasViewport) issues.push("Missing mobile viewport — poor mobile experience");
  if (!htmlMeta.ssrLikely) issues.push(`Rendering: ${htmlMeta.ssrNote}`);
  if (localRank && localRank.rank >= 21) {
    issues.push(`Not on Google page 1 for "${localRank.keyword}" (rank ${localRank.rankLabel})`);
  } else if (localRank && localRank.rank > 3) {
    issues.push(`Google Maps rank #${localRank.rankLabel} for "${localRank.keyword}" — top 3 get most clicks`);
  }
  if (keywords.missingOpportunities.length > 0) {
    issues.push(`Missing keyword opportunities: ${keywords.missingOpportunities.slice(0, 3).join(", ")}`);
  }

  const recommendations: string[] = [];

  if (scores.performance < 85) {
    recommendations.push("Compress images, enable caching, and reduce JavaScript for faster load times");
  }
  if (scores.seo < 90) {
    recommendations.push("Optimize title tags, meta descriptions, and heading structure for target keywords");
  }
  if (!htmlMeta.hasStructuredData) {
    recommendations.push("Add LocalBusiness schema markup for better Google visibility");
  }
  if (htmlMeta.wordCount < 300) {
    recommendations.push("Add more service-area content — thin pages rank poorly");
  }
  recommendations.push("Set up conversion tracking and clear call-to-action above the fold");
  if (localRank && localRank.rank > 3) {
    recommendations.push("Combine website fixes with Google Business Profile + local SEO");
  }

  const rankLine = localRank
    ? `\n• Google search position: #${localRank.rankLabel} for "${localRank.keyword}"`
    : "";

  const pitch = `Hi ${businessName},

We ran a full website audit on ${url}.

Here's what we found:
• Overall website grade: ${grade} (${overallScore}/100)
• Performance: ${scores.performance}/100 | SEO: ${scores.seo}/100 | Accessibility: ${scores.accessibility}/100${rankLine}

${issues.length > 0 ? `Key issues:\n${issues.slice(0, 3).map((i) => `• ${i}`).join("\n")}` : "Your site has a solid foundation with room to improve."}

We can fix these issues and help you rank higher on Google — would you be open to a quick call to review this free audit?

Best regards`;

  return {
    grade,
    gradeLabel,
    gradeColor,
    overallScore,
    issues: issues.slice(0, 6),
    recommendations: recommendations.slice(0, 5),
    pitch,
  };
}
