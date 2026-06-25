"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HeatmapReportView } from "@/components/features/leads/HeatmapReportView";
import { fetchSharedReport, scanHeatmapApi } from "@/lib/api/heatmap.client";
import type { Lead } from "@/lib/types";
import type { HeatmapScanResult } from "@/lib/types/heatmap";
import { extractHeatmapShareToken } from "@/lib/utils/heatmap-share";

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onLeadUpdated?: (placeId: string, updates: Partial<Lead>) => void;
}

function defaultKeyword(lead: Lead): string {
  if (lead.heatmapKeyword) return lead.heatmapKeyword;
  if (lead.searchCategory) {
    return `${lead.searchCategory} near me`;
  }
  return "local business near me";
}

export function LeadModal({ lead, onClose, onLeadUpdated }: LeadModalProps) {
  const [keyword, setKeyword] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<HeatmapScanResult | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!lead) return;

    let cancelled = false;
    const initialKeyword = defaultKeyword(lead);

    setKeyword(initialKeyword);
    setScanError(null);
    setResult(null);
    setShareUrl(lead.heatmapShareUrl ?? "");

    if (!lead.heatmapShareUrl) return;

    const token = extractHeatmapShareToken(lead.heatmapShareUrl);
    if (!token) return;

    setLoadingSaved(true);
    fetchSharedReport(token)
      .then((report) => {
        if (cancelled) return;
        setResult(report.result);
        if (report.result?.keyword) {
          setKeyword(report.result.keyword);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScanError("Saved heatmap link could not be loaded. Run a new scan.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lead]);

  const handleScan = async () => {
    if (!lead || !keyword.trim()) return;
    setScanning(true);
    setScanError(null);
    try {
      const scanResult = await scanHeatmapApi({
        placeId: lead.placeId,
        keyword: keyword.trim(),
        gridSize: 7,
        hasWebsite: Boolean(lead.website && lead.website !== "N/A"),
        lead,
      });
      setResult(scanResult);
      const nextShareUrl = scanResult.shareUrl ?? "";
      setShareUrl(nextShareUrl);
      onLeadUpdated?.(lead.placeId, {
        heatmapShareUrl: nextShareUrl || null,
        heatmapKeyword: keyword.trim(),
      });
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "Heatmap scan failed"
      );
    } finally {
      setScanning(false);
    }
  };

  if (!lead) return null;

  const snapshot = {
    placeId: lead.placeId,
    name: lead.name,
    address: lead.address,
    phone: lead.phone,
    website: lead.website,
    email: lead.email,
    searchCategory: lead.searchCategory,
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/60 backdrop-blur-[6px]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col w-full max-w-[1380px] h-[min(92vh,880px)] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)] ring-1 ring-zinc-950/5"
          onClick={(e) => e.stopPropagation()}
        >
          <HeatmapReportView
            lead={snapshot}
            result={result}
            scanning={scanning || loadingSaved}
            keyword={keyword}
            onKeywordChange={setKeyword}
            onScan={handleScan}
            scanError={scanError}
            shareUrl={shareUrl}
            onClose={onClose}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
