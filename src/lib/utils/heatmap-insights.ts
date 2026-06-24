import type {
  HeatmapBusinessInfo,
  HeatmapCompetitor,
  HeatmapInsights,
  HeatmapSummary,
} from "@/lib/types/heatmap";

const NOT_RANKED = 21;

function rankLabel(rank: number): string {
  return rank >= NOT_RANKED ? "20+" : String(rank);
}

export function buildHeatmapInsights(params: {
  business: HeatmapBusinessInfo;
  keyword: string;
  summary: HeatmapSummary;
  businessRank: number;
  competitors: HeatmapCompetitor[];
  hasWebsite: boolean;
}): HeatmapInsights {
  const { business, keyword, summary, businessRank, competitors, hasWebsite } =
    params;

  const visibilityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        summary.top3Percent * 0.45 +
          summary.page1Percent * 0.35 +
          (businessRank <= 3 ? 20 : businessRank <= 10 ? 10 : 0)
      )
    )
  );

  let grade = "F";
  let gradeLabel = "Critical — mostly invisible locally";
  let gradeColor = "#dc2626";

  if (visibilityScore >= 85) {
    grade = "A";
    gradeLabel = "Strong — dominating local search";
    gradeColor = "#166534";
  } else if (visibilityScore >= 70) {
    grade = "B";
    gradeLabel = "Good — visible but room to grow";
    gradeColor = "#22c55e";
  } else if (visibilityScore >= 55) {
    grade = "C";
    gradeLabel = "Average — competitors are winning key spots";
    gradeColor = "#eab308";
  } else if (visibilityScore >= 35) {
    grade = "D";
    gradeLabel = "Weak — losing customers in nearby areas";
    gradeColor = "#f97316";
  }

  const issues: string[] = [];
  const opportunities: string[] = [];

  if (businessRank >= NOT_RANKED) {
    issues.push(
      `Not on Google page 1 for "${keyword}" at your own business location`
    );
  } else if (businessRank > 3) {
    issues.push(
      `Ranks #${businessRank} at your location — top 3 get most map clicks`
    );
  }

  if (summary.notRankingPercent >= 30) {
    issues.push(
      `Invisible in ${summary.notRankingPercent}% of scanned neighborhoods (${summary.notRankingCount} blind spots)`
    );
  }

  if (summary.top3Percent < 40) {
    issues.push(
      `Only visible in top 3 positions ${summary.top3Percent}% of the service area`
    );
  }

  const topCompetitor = competitors.find((c) => !c.isTarget && c.rank === 1);
  if (topCompetitor) {
    const theirReviews = topCompetitor.userRatingsTotal ?? 0;
    const yourReviews = business.userRatingsTotal ?? 0;
    if (theirReviews > yourReviews && yourReviews > 0) {
      issues.push(
        `#1 competitor "${topCompetitor.name}" has ${theirReviews.toLocaleString()} reviews vs your ${yourReviews.toLocaleString()}`
      );
    } else if (yourReviews === 0) {
      issues.push("No Google reviews detected — trust signals are missing");
    }

    const theirRating = topCompetitor.rating ?? 0;
    const yourRating = business.rating ?? 0;
    if (theirRating > yourRating && yourRating > 0) {
      issues.push(
        `Top competitor outranks your ${yourRating.toFixed(1)}★ rating with ${theirRating.toFixed(1)}★`
      );
    }
  }

  if (!hasWebsite || !business.website) {
    issues.push("No website linked on Google — you lose credibility and conversions");
  }

  if (businessRank <= 3) {
    opportunities.push("Strong anchor position at your location — expand into weak grid zones");
  }

  if (summary.notRankingPercent > 0) {
    opportunities.push(
      `Fix ${summary.notRankingCount} blind-spot areas to capture nearby search demand`
    );
  }

  if ((business.userRatingsTotal ?? 0) < 100) {
    opportunities.push("Review generation campaign can quickly boost map rankings");
  }

  opportunities.push("Google Business Profile optimization + local landing pages");
  opportunities.push("Targeted ads in red-zone neighborhoods while SEO improves");

  const pitch = buildPitch({
    business,
    keyword,
    businessRank,
    summary,
    grade,
    topCompetitor,
  });

  return {
    grade,
    gradeLabel,
    gradeColor,
    businessRank,
    businessRankLabel: rankLabel(businessRank),
    visibilityScore,
    issues: issues.slice(0, 5),
    opportunities: opportunities.slice(0, 4),
    pitch,
  };
}

function buildPitch(params: {
  business: HeatmapBusinessInfo;
  keyword: string;
  businessRank: number;
  summary: HeatmapSummary;
  grade: string;
  topCompetitor?: HeatmapCompetitor;
}): string {
  const { business, keyword, businessRank, summary, grade, topCompetitor } =
    params;
  const rankText =
    businessRank >= NOT_RANKED ? "not on page 1" : `#${businessRank}`;
  const competitorLine = topCompetitor
    ? `\nRight now, "${topCompetitor.name}" holds the #1 spot in your area.`
    : "";

  return `Hi ${business.name},

We ran a live Google Maps visibility scan for "${keyword}" around your business.

Here's what we found:
• Your position at your location: ${rankText}
• Local visibility score: ${grade} (${summary.top3Percent}% top-3 coverage)
• Blind spots: ${summary.notRankingPercent}% of nearby areas where you're not showing on page 1${competitorLine}

This means potential customers are finding competitors instead of you — even blocks away.

We specialize in fixing exactly this: Google Business Profile optimization, review growth, and local SEO to get you into the green zones on the map.

Would you be open to a quick 15-minute call to review your free heatmap report?

Best regards`;
}
