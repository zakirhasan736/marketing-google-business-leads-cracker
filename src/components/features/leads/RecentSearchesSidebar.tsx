"use client";

import { Clock, Trash2 } from "lucide-react";
import type { RecentSearch } from "@/lib/types";

interface RecentSearchesSidebarProps {
  searches: RecentSearch[];
  onSelect: (search: RecentSearch) => void;
  onDelete: (index: number) => void;
}

export function RecentSearchesSidebar({
  searches,
  onSelect,
  onDelete,
}: RecentSearchesSidebarProps) {
  return (
    <aside className="w-80 border-l border-neutral-100 p-8 overflow-y-auto bg-white">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-neutral-900">
        <Clock size={22} className="text-blue-600" /> Recent Searches
      </h2>
      <div className="space-y-4">
        {searches.length === 0 && (
          <p className="text-neutral-400 text-sm">No recent searches yet.</p>
        )}
        {searches.map((s, i) => (
          <div
            key={`${s.zip}-${s.state}-${s.date}`}
            className="group w-full text-left p-4 rounded-xl hover:bg-neutral-50 border border-neutral-100 text-sm flex justify-between items-center transition-all"
          >
            <button onClick={() => onSelect(s)} className="flex-1 text-left">
              <p className="font-semibold text-neutral-900">
                {s.category ?? "All categories"}
              </p>
              <p className="text-neutral-500 text-xs">
                {s.zip}, {s.state}, {s.country}
              </p>
            </button>
            <button
              onClick={() => onDelete(i)}
              className="text-neutral-300 group-hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
