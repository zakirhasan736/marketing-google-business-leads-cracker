"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface LeadsTablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function LeadsTablePagination({
  page,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageSize,
  onPageChange,
  disabled = false,
}: LeadsTablePaginationProps) {
  if (totalItems === 0) return null;

  const pages = buildPageNumbers(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-neutral-200">
      <p className="text-sm text-neutral-500">
        Showing {startIndex}–{endIndex} of {totalItems} leads ({pageSize} per
        page)
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-neutral-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              disabled={disabled}
              className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-medium border transition ${
                page === p
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-neutral-200 hover:bg-neutral-50 text-neutral-700"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function buildPageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }

  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "...", current - 1, current, current + 1, "...", total];
}
