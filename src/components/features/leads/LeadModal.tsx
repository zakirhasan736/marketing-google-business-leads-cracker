"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Lead } from "@/lib/types";
import { getLeadMapsUrl } from "@/lib/utils/google-maps";

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
}

export function LeadModal({ lead, onClose }: LeadModalProps) {
  if (!lead) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl p-8 max-w-lg w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{lead.name}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="font-semibold text-sm text-neutral-500">
                Map Address
              </label>
              <p>{lead.address || "—"}</p>
              {lead.address && (
                <a
                  href={getLeadMapsUrl(lead)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Open in Google Maps
                </a>
              )}
            </div>
            <div>
              <label className="font-semibold text-sm text-neutral-500">
                Phone
              </label>
              <p>{lead.phone}</p>
            </div>
            <div>
              <label className="font-semibold text-sm text-neutral-500">
                Email
              </label>
              <p>{lead.email || "N/A"}</p>
            </div>
            {lead.contactPageUrl && !lead.email && (
              <div>
                <label className="font-semibold text-sm text-neutral-500">
                  Contact Form
                </label>
                <a
                  href={lead.contactPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {lead.contactPageUrl}
                </a>
              </div>
            )}
            <div>
              <label className="font-semibold text-sm text-neutral-500">
                Website
              </label>
              <p>{lead.website}</p>
            </div>
            <div>
              <label className="font-semibold text-sm text-neutral-500">
                Place ID
              </label>
              <p className="font-mono text-sm">{lead.placeId}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
