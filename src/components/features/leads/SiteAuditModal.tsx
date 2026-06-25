"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SiteAuditReportView } from "@/components/features/leads/SiteAuditReportView";
import type { AuditDevice } from "@/components/features/leads/AuditDeviceToggle";
import { fetchSharedSiteAudit, runSiteAuditApi } from "@/lib/api/site-audit.client";
import type { Lead } from "@/lib/types";
import type { SiteAuditResult } from "@/lib/types/site-audit";
import { extractSiteAuditShareToken } from "@/lib/utils/site-audit-share";

interface SiteAuditModalProps {
  lead: Lead | null;
  onClose: () => void;
  onLeadUpdated?: (placeId: string, updates: Partial<Lead>) => void;
}

type ResultsByDevice = Partial<Record<AuditDevice, SiteAuditResult>>;

export function SiteAuditModal({ lead, onClose, onLeadUpdated }: SiteAuditModalProps) {
  const [strategy, setStrategy] = useState<AuditDevice>("mobile");
  const [resultsByDevice, setResultsByDevice] = useState<ResultsByDevice>({});
  const [auditingStrategy, setAuditingStrategy] = useState<AuditDevice | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [headlessRender, setHeadlessRender] = useState(false);

  const result = resultsByDevice[strategy] ?? null;
  const auditing = auditingStrategy !== null;

  useEffect(() => {
    if (!lead) return;

    let cancelled = false;
    setAuditError(null);
    setResultsByDevice({});
    setStrategy("mobile");
    setShareUrl(lead.siteAuditShareUrl ?? "");

    if (!lead.siteAuditShareUrl) return;

    const token = extractSiteAuditShareToken(lead.siteAuditShareUrl);
    if (!token) return;

    setLoadingSaved(true);
    fetchSharedSiteAudit(token)
      .then((report) => {
        if (cancelled) return;
        const saved = report.result;
        const device: AuditDevice = saved.strategy === "desktop" ? "desktop" : "mobile";
        setResultsByDevice({ [device]: saved });
        setStrategy(device);
      })
      .catch(() => {
        if (!cancelled) {
          setAuditError("Saved audit link could not be loaded. Run a new audit.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lead]);

  const canAudit = Boolean(lead?.website && lead.website !== "N/A");

  const runAudit = useCallback(
    async (forStrategy: AuditDevice) => {
      if (!lead || !canAudit) return;

      setAuditingStrategy(forStrategy);
      setAuditError(null);

      try {
        const auditResult = await runSiteAuditApi({
          url: lead.website,
          lead,
          strategy: forStrategy,
          headlessRender,
        });

        setResultsByDevice((prev) => ({ ...prev, [forStrategy]: auditResult }));
        setStrategy(forStrategy);

        const nextShareUrl = auditResult.shareUrl ?? "";
        if (nextShareUrl) {
          setShareUrl(nextShareUrl);
          onLeadUpdated?.(lead.placeId, {
            siteAuditShareUrl: nextShareUrl,
          });
        }
      } catch (error) {
        setAuditError(
          error instanceof Error ? error.message : "Site audit failed"
        );
      } finally {
        setAuditingStrategy(null);
      }
    },
    [lead, canAudit, onLeadUpdated, headlessRender]
  );

  const handleRunAudit = () => runAudit(strategy);

  const handleStrategyChange = (next: AuditDevice) => {
    setStrategy(next);
    setAuditError(null);
    if (!resultsByDevice[next] && canAudit && auditingStrategy === null) {
      void runAudit(next);
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

  const deviceAvailable: Partial<Record<AuditDevice, boolean>> = {
    mobile: Boolean(resultsByDevice.mobile),
    desktop: Boolean(resultsByDevice.desktop),
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          transition={{ type: "spring", damping: 28, stiffness: 360 }}
          className="bg-[#f4f6fa] rounded-2xl w-full max-w-[1280px] h-[min(94vh,920px)] flex flex-col shadow-2xl shadow-black/30 overflow-hidden border border-white/20 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2.5 bg-white hover:bg-slate-50 rounded-xl shadow-md border border-slate-200/80 transition text-slate-500 hover:text-slate-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <SiteAuditReportView
            lead={snapshot}
            result={result}
            strategy={strategy}
            onStrategyChange={handleStrategyChange}
            deviceAvailable={deviceAvailable}
            scanningStrategy={auditingStrategy}
            auditing={auditing || loadingSaved}
            onRunAudit={handleRunAudit}
            auditError={auditError}
            shareUrl={shareUrl}
            canAudit={canAudit}
            headlessRender={headlessRender}
            onHeadlessRenderChange={setHeadlessRender}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
