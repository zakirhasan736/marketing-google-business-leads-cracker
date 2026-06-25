"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SiteAuditReportView } from "@/components/features/leads/SiteAuditReportView";
import { fetchSharedSiteAudit } from "@/lib/api/site-audit.client";
import type { PublicSiteAuditReport } from "@/lib/types/site-audit";

export default function SharedSiteAuditPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<PublicSiteAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        const data = await fetchSharedSiteAudit(token);
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Report not found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-neutral-50">
        <Loader2 size={32} className="animate-spin text-violet-600" />
        <p className="text-sm text-neutral-500">Loading website audit…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-neutral-50 p-6 text-center">
        <p className="text-lg font-semibold text-neutral-800">Report not found</p>
        <p className="text-sm text-neutral-500">{error ?? "Invalid link"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-3 sm:p-6">
      <div className="max-w-[1400px] mx-auto h-[min(94vh,900px)] rounded-2xl overflow-hidden shadow-xl border border-neutral-200 bg-white">
        <SiteAuditReportView
          lead={report.lead}
          result={report.result}
          strategy={report.result.strategy === "desktop" ? "desktop" : "mobile"}
          deviceAvailable={{
            [report.result.strategy === "desktop" ? "desktop" : "mobile"]: true,
          }}
          readOnly
        />
      </div>
      <p className="text-center text-[11px] text-neutral-400 mt-4">
        Website audit report · powered by Google PageSpeed Insights
      </p>
    </div>
  );
}
