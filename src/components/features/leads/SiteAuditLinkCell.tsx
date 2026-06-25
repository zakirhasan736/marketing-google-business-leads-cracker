"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

interface SiteAuditLinkCellProps {
  shareUrl?: string | null;
}

export function SiteAuditLinkCell({ shareUrl }: SiteAuditLinkCellProps) {
  const [copied, setCopied] = useState(false);

  if (!shareUrl) {
    return <span className="text-neutral-400 text-xs">—</span>;
  }

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-600 hover:text-violet-800 inline-flex items-center gap-0.5 text-xs font-medium"
        title={shareUrl}
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink size={12} />
        Open
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-0.5 text-xs font-medium"
        title="Copy site audit link"
      >
        {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
