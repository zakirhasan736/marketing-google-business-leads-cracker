"use client";

import { useEffect, useState } from "react";
import { categories } from "@/lib/constants/geo-data";

const STORAGE_KEY = "leadSearchSelectedCategories";

function loadSelectedCategories(): Set<string> {
  if (typeof window === "undefined") {
    return new Set(categories);
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      const valid = parsed.filter((c) =>
        (categories as readonly string[]).includes(c)
      );
      if (valid.length > 0) return new Set(valid);
    }
  } catch {
    // ignore invalid storage
  }

  return new Set(categories);
}

interface LeadCategoryPickerProps {
  disabled?: boolean;
  onChange: (selected: string[]) => void;
}

export function LeadCategoryPicker({
  disabled = false,
  onChange,
}: LeadCategoryPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(() =>
    loadSelectedCategories()
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onChange(Array.from(selected));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected)));
  }, [selected, onChange]);

  const allSelected = selected.size === categories.length;
  const noneSelected = selected.size === 0;

  const toggle = (category: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(categories));
  const deselectAll = () => setSelected(new Set());

  return (
    <div className="mt-4 border border-neutral-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition text-left disabled:opacity-60"
      >
        <span className="text-sm font-semibold text-neutral-800">
          Categories ({selected.size} of {categories.length} selected)
        </span>
        <span className="text-sm text-blue-600 shrink-0">
          {open ? "Hide" : "Choose categories"}
        </span>
      </button>

      {open && (
        <div className="p-4 bg-white border-t border-neutral-100">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={selectAll}
              disabled={disabled || allSelected}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={deselectAll}
              disabled={disabled || noneSelected}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
            >
              Deselect all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
            {categories.map((category) => {
              const checked = selected.has(category);
              return (
                <label
                  key={category}
                  className={`flex items-center gap-2.5 text-sm rounded-lg px-3 py-2 cursor-pointer border transition ${
                    checked
                      ? "bg-blue-50 border-blue-100 text-neutral-900"
                      : "bg-white border-neutral-100 text-neutral-500 hover:bg-neutral-50"
                  } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(category)}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="leading-tight">{category}</span>
                </label>
              );
            })}
          </div>

          {noneSelected && (
            <p className="mt-3 text-sm text-amber-600">
              Select at least one category to search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function getDefaultSelectedCategories(): string[] {
  return Array.from(loadSelectedCategories());
}
