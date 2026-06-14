"use client";

import { useCallback, useState } from "react";
import { Search, Loader2, Square } from "lucide-react";
import { categories, geoData, type CountryKey } from "@/lib/constants/geo-data";
import {
  getDefaultSelectedCategories,
  LeadCategoryPicker,
} from "@/components/features/leads/LeadCategoryPicker";

interface LeadSearchFormProps {
  country: string;
  state: string;
  zip: string;
  loading: boolean;
  batchLabel: string | null;
  onCountryChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onZipChange: (value: string) => void;
  onSearch: (selectedCategories: string[]) => void;
  onStopSearch: () => void;
}

export function LeadSearchForm({
  country,
  state,
  zip,
  loading,
  batchLabel,
  onCountryChange,
  onStateChange,
  onZipChange,
  onSearch,
  onStopSearch,
}: LeadSearchFormProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    getDefaultSelectedCategories
  );

  const handleCategoriesChange = useCallback((selected: string[]) => {
    setSelectedCategories(selected);
  }, []);

  const countryData = country ? geoData[country as CountryKey] : null;
  const zips =
    countryData && state
      ? (countryData.zips[state as keyof typeof countryData.zips] as
          | string[]
          | undefined) ?? []
      : [];

  const canSearch =
    Boolean(country && state && zip) && selectedCategories.length > 0;

  return (
    <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={loading}
          className="border border-neutral-200 p-3 rounded-xl disabled:bg-neutral-100"
        >
          <option value="">Select Country</option>
          {Object.keys(geoData).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={state}
          onChange={(e) => onStateChange(e.target.value)}
          disabled={!country || loading}
          className="border border-neutral-200 p-3 rounded-xl disabled:bg-neutral-100"
        >
          <option value="">Select State</option>
          {countryData?.states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={zip}
          onChange={(e) => onZipChange(e.target.value)}
          disabled={!state || loading}
          className="border border-neutral-200 p-3 rounded-xl disabled:bg-neutral-100"
        >
          <option value="">Select Zip</option>
          {zips.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>

      <LeadCategoryPicker
        disabled={loading}
        onChange={handleCategoriesChange}
      />

      <p className="mt-3 text-sm text-neutral-500">
        {selectedCategories.length === categories.length
          ? `All ${categories.length} categories will be searched.`
          : `${selectedCategories.length} of ${categories.length} categories will be searched.`}
      </p>

      {batchLabel && (
        <p className="mt-2 text-sm font-medium text-blue-600 animate-pulse">
          {batchLabel}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => onSearch(selectedCategories)}
          disabled={!canSearch || loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white p-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Search size={20} />
          )}
          Search Leads
        </button>
        {loading && (
          <button
            onClick={onStopSearch}
            className="px-6 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 p-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
          >
            <Square size={18} /> Stop
          </button>
        )}
      </div>
    </section>
  );
}
