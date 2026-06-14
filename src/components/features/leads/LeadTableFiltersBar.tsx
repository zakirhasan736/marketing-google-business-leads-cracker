"use client";

import { Filter, X } from "lucide-react";
import { LEAD_STATUSES } from "@/lib/constants/lead-status";
import type { LeadTableFilters } from "@/lib/utils/lead-filters";

interface LeadTableFiltersBarProps {
  filters: LeadTableFilters;
  options: {
    categories: string[];
    countries: string[];
    states: string[];
    zips: string[];
  };
  filteredCount: number;
  totalCount: number;
  onChange: (filters: LeadTableFilters) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function LeadTableFiltersBar({
  filters,
  options,
  filteredCount,
  totalCount,
  onChange,
  onClear,
  disabled = false,
}: LeadTableFiltersBarProps) {
  const hasActiveFilters = Object.values(filters).some((value) => value !== "All");

  return (
    <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-neutral-100 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <Filter size={16} className="text-blue-600" />
          Filter leads
          <span className="font-normal text-neutral-500">
            ({filteredCount} of {totalCount})
          </span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-sm text-neutral-600 hover:text-neutral-900 flex items-center gap-1 disabled:opacity-40"
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <FilterSelect
          label="Category"
          value={filters.category}
          options={options.categories}
          onChange={(category) => onChange({ ...filters, category })}
          disabled={disabled}
        />
        <FilterSelect
          label="Country"
          value={filters.country}
          options={options.countries}
          onChange={(country) =>
            onChange({ ...filters, country, state: "All", zip: "All" })
          }
          disabled={disabled}
        />
        <FilterSelect
          label="State"
          value={filters.state}
          options={options.states}
          onChange={(state) => onChange({ ...filters, state, zip: "All" })}
          disabled={disabled}
        />
        <FilterSelect
          label="Zip"
          value={filters.zip}
          options={options.zips}
          onChange={(zip) => onChange({ ...filters, zip })}
          disabled={disabled}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={[...LEAD_STATUSES]}
          onChange={(status) => onChange({ ...filters, status })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-500 mb-1 block">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-neutral-200 rounded-lg p-2.5 text-sm bg-white disabled:bg-neutral-100 disabled:opacity-60"
      >
        <option value="All">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export { DEFAULT_LEAD_FILTERS } from "@/lib/utils/lead-filters";
