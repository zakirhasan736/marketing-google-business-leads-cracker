"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SiteAuditReportView } from "@/components/features/leads/SiteAuditReportView";
import { runSiteAuditApi } from "@/lib/api/site-audit.client";
import type { Lead } from "@/lib/types";
import type { SiteAuditResult } from "@/lib/types/site-audit";

interface SiteAuditModalProps {
  lead: Lead | null;
  onClose: () => void;
}

export function SiteAuditModal({ lead, onClose }: SiteAuditModalProps) {
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [result, setResult] = useState<SiteAuditResult | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!lead) return;
    setAuditError(null);
    setResult(null);
    setShareUrl("");
  }, [lead]);

  const canAudit = Boolean(lead?.website && lead.website !== "N/A");

  const handleAudit = async () => {
    if (!lead || !canAudit) return;
    setAuditing(true);
    setAuditError(null);
    try {
      const auditResult = await runSiteAuditApi({
        url: lead.website,
        lead,
      });
      setResult(auditResult);
      setShareUrl(auditResult.shareUrl ?? "");
    } catch (error) {
      setAuditError(
        error instanceof Error ? error.message : "Site audit failed"
      );
    } finally {
      setAuditing(false);
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
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          className="bg-neutral-50 rounded-2xl w-full max-w-[1400px] h-[min(92vh,900px)] flex flex-col shadow-2xl overflow-hidden border border-neutral-200 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 p-2 bg-white/90 hover:bg-white rounded-xl shadow-sm border border-neutral-200 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <SiteAuditReportView
            lead={snapshot}
            result={result}
            auditing={auditing}
            onRunAudit={handleAudit}
            auditError={auditError}
            shareUrl={shareUrl}
            canAudit={canAudit}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
