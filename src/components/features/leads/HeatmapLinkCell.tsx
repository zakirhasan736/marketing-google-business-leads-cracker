"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

interface HeatmapLinkCellProps {
  shareUrl?: string | null;
  keyword?: string | null;
}

export function HeatmapLinkCell({ shareUrl, keyword }: HeatmapLinkCellProps) {
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
    <div className="flex flex-col gap-1 min-w-[120px]">
      {keyword && (
        <span className="text-[10px] text-neutral-500 truncate max-w-[160px]" title={keyword}>
          {keyword}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5 text-xs font-medium"
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
          title="Copy heatmap report link"
        >
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
