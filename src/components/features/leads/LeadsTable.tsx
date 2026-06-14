"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Loader2, Mail, MapPin, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LeadTableFiltersBar,
  DEFAULT_LEAD_FILTERS,
} from "@/components/features/leads/LeadTableFiltersBar";
import { EditableEmailCell } from "@/components/features/leads/EditableEmailCell";
import { LeadsTablePagination } from "@/components/features/leads/LeadsTablePagination";
import type { Lead, LeadStatus } from "@/lib/types";
import { LEAD_STATUSES } from "@/lib/constants/lead-status";
import {
  buildFilterOptions,
  filterLeads,
  getLeadLocationParts,
  getStatesForCountry,
  getZipsForFilters,
  LEADS_PAGE_SIZE,
  paginateLeads,
  type LeadTableFilters,
} from "@/lib/utils/lead-filters";
import { getLeadMapsUrl } from "@/lib/utils/google-maps";

interface LeadsTableProps {
  leads: Lead[];
  selectedLeads: Set<string>;
  loading: boolean;
  deleting: boolean;
  searchStatus: string;
  batchLabel?: string | null;
  onToggleLead: (placeId: string) => void;
  onToggleSelectionForLeads: (targetLeads: Lead[]) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onStatusChange: (placeId: string, status: LeadStatus) => void;
  onNoteChange: (placeId: string, note: string) => void;
  onEmailChange: (placeId: string, email: string) => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
  onDeleteSingle: (placeId: string) => void;
  onFindMissingEmails: () => void;
  onStopEmailScan?: () => void;
  onExportLeads: (leads: Lead[]) => void;
  onLeadClick: (lead: Lead) => void;
}

export function LeadsTable({
  leads,
  selectedLeads,
  loading,
  deleting,
  searchStatus,
  batchLabel,
  onToggleLead,
  onToggleSelectionForLeads,
  onSelectAll,
  onClearSelection,
  onStatusChange,
  onNoteChange,
  onEmailChange,
  onDeleteSelected,
  onDeleteAll,
  onDeleteSingle,
  onFindMissingEmails,
  onStopEmailScan,
  onExportLeads,
  onLeadClick,
}: LeadsTableProps) {
  const [filters, setFilters] = useState<LeadTableFilters>(DEFAULT_LEAD_FILTERS);
  const [page, setPage] = useState(1);

  const filteredLeads = useMemo(
    () => filterLeads(leads, filters),
    [leads, filters]
  );

  const pagination = useMemo(
    () => paginateLeads(filteredLeads, page, LEADS_PAGE_SIZE),
    [filteredLeads, page]
  );

  const paginatedLeads = pagination.items;

  const baseOptions = useMemo(() => buildFilterOptions(leads), [leads]);

  const filterOptions = useMemo(
    () => ({
      categories: baseOptions.categories,
      countries: baseOptions.countries,
      states: getStatesForCountry(leads, filters.country),
      zips: getZipsForFilters(leads, filters.country, filters.state),
    }),
    [leads, baseOptions.categories, baseOptions.countries, filters.country, filters.state]
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

  const allFilteredSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((l) => selectedLeads.has(l.placeId));

  const allPageSelected =
    paginatedLeads.length > 0 &&
    paginatedLeads.every((l) => selectedLeads.has(l.placeId));

  const allLeadsSelected =
    leads.length > 0 && leads.every((l) => selectedLeads.has(l.placeId));

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      LEAD_STATUSES.map((s) => [s, 0])
    ) as Record<string, number>;
    for (const biz of leads) {
      const status = biz.status || "New";
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const emailScanActive =
    Boolean(batchLabel) && batchLabel!.startsWith("Finding emails");

  const handleExport = () => {
    const toExport =
      selectedLeads.size > 0
        ? filteredLeads.filter((l) => selectedLeads.has(l.placeId))
        : filteredLeads;
    onExportLeads(toExport);
  };

  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100"
          >
            <h3 className="text-neutral-500 text-sm font-medium">{status}</h3>
            <p className="text-3xl font-extrabold">{count}</p>
          </div>
        ))}
      </section>

      <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 relative mb-8">
        <AnimatePresence>
          {selectedLeads.size > 0 && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white py-3 px-6 rounded-full flex items-center gap-4 shadow-lg z-50"
            >
              <span>{selectedLeads.size} selected</span>
              <button
                onClick={onDeleteSelected}
                disabled={deleting}
                className="flex items-center gap-1 hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 size={16} /> Delete selected
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <h2 className="text-xl font-bold">Leads ({filteredLeads.length})</h2>
          {searchStatus !== "idle" && searchStatus !== "complete" && (
            <span className="text-blue-600 text-sm font-medium animate-pulse">
              {searchStatus}
            </span>
          )}
          {emailScanActive && (
            <span className="text-blue-600 text-sm font-medium animate-pulse flex items-center gap-2">
              {batchLabel}
              {onStopEmailScan && (
                <button
                  type="button"
                  onClick={onStopEmailScan}
                  className="text-red-600 hover:underline font-semibold"
                >
                  Stop
                </button>
              )}
            </span>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onFindMissingEmails}
              disabled={loading || deleting}
              className="text-blue-600 flex items-center gap-1 font-semibold text-sm hover:underline disabled:opacity-50"
            >
              {loading && emailScanActive ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Mail size={18} />
              )}{" "}
              Find Missing Emails
            </button>
            <button
              onClick={handleExport}
              disabled={loading || deleting || filteredLeads.length === 0}
              className="text-blue-600 flex items-center gap-1 font-semibold text-sm hover:underline disabled:opacity-50"
            >
              <FileDown size={18} /> Export
              {selectedLeads.size > 0 ? ` (${selectedLeads.size})` : ""}
            </button>
          </div>
        </div>

        <LeadTableFiltersBar
          filters={filters}
          options={filterOptions}
          filteredCount={filteredLeads.length}
          totalCount={leads.length}
          onChange={setFilters}
          onClear={() => setFilters(DEFAULT_LEAD_FILTERS)}
          disabled={deleting}
        />

        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={leads.length === 0 || deleting || allLeadsSelected}
            className="text-sm font-medium px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 disabled:opacity-40"
          >
            Select all ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => onToggleSelectionForLeads(filteredLeads)}
            disabled={filteredLeads.length === 0 || deleting}
            className="text-sm font-medium px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 disabled:opacity-40"
          >
            {allFilteredSelected ? "Deselect filtered" : "Select filtered"} (
            {filteredLeads.length})
          </button>
          {selectedLeads.size > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              disabled={deleting}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 disabled:opacity-40"
            >
              Clear selection
            </button>
          )}
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={selectedLeads.size === 0 || deleting}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 flex items-center gap-1"
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete selected ({selectedLeads.size})
          </button>
          <button
            type="button"
            onClick={onDeleteAll}
            disabled={leads.length === 0 || deleting}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 flex items-center gap-1 ml-auto"
          >
            <Trash2 size={14} /> Delete all from database
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    onChange={() => onToggleSelectionForLeads(paginatedLeads)}
                    checked={allPageSelected}
                    disabled={deleting || paginatedLeads.length === 0}
                  />
                </th>
                <th className="p-4 font-semibold text-neutral-600">Name</th>
                <th className="p-4 font-semibold text-neutral-600">Category</th>
                <th className="p-4 font-semibold text-neutral-600">Location</th>
                <th className="p-4 font-semibold text-neutral-600 min-w-[200px]">
                  Map Address
                </th>
                <th className="p-4 font-semibold text-neutral-600">Email</th>
                <th className="p-4 font-semibold text-neutral-600">Phone</th>
                <th className="p-4 font-semibold text-neutral-600">Status</th>
                <th className="p-4 font-semibold text-neutral-600">Website</th>
                <th className="p-4 font-semibold text-neutral-600">Notes</th>
                <th className="p-4 font-semibold text-neutral-600">Action</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {paginatedLeads.map((biz) => {
                  const loc = getLeadLocationParts(biz);
                  return (
                    <motion.tr
                      key={biz.placeId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="border-b border-neutral-100 hover:bg-neutral-50"
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(biz.placeId)}
                          onChange={() => onToggleLead(biz.placeId)}
                          disabled={deleting}
                        />
                      </td>
                      <td
                        className="p-4 font-medium text-neutral-900 cursor-pointer hover:text-blue-600 max-w-[180px] truncate"
                        onClick={() => onLeadClick(biz)}
                        title={biz.name}
                      >
                        {biz.name}
                      </td>
                      <td className="p-4 text-neutral-700 text-sm max-w-[140px] truncate" title={biz.searchCategory ?? ""}>
                        {biz.searchCategory || "—"}
                      </td>
                      <td className="p-4 text-neutral-700 text-xs max-w-[160px]">
                        {loc.zip && (
                          <div>
                            {loc.zip}, {loc.state}
                          </div>
                        )}
                        <div className="text-neutral-500">{loc.country || "—"}</div>
                      </td>
                      <td className="p-4 text-neutral-700 text-xs max-w-[220px]">
                        {biz.address ? (
                          <a
                            href={getLeadMapsUrl(biz)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-start gap-1"
                            title={biz.address}
                          >
                            <MapPin
                              size={14}
                              className="shrink-0 mt-0.5 text-red-500"
                            />
                            <span className="line-clamp-2">{biz.address}</span>
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4 text-neutral-700 text-sm">
                        <EditableEmailCell
                          placeId={biz.placeId}
                          email={biz.email}
                          contactPageUrl={biz.contactPageUrl}
                          disabled={deleting}
                          onSave={onEmailChange}
                        />
                      </td>
                      <td className="p-4 text-neutral-700 text-sm whitespace-nowrap">
                        {biz.phone}
                      </td>
                      <td className="p-4">
                        <select
                          value={biz.status || "New"}
                          onChange={(e) =>
                            onStatusChange(
                              biz.placeId,
                              e.target.value as LeadStatus
                            )
                          }
                          disabled={deleting}
                          className="text-sm bg-neutral-100 p-2 rounded-lg"
                        >
                          {LEAD_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        {biz.website && biz.website !== "N/A" ? (
                          <a
                            href={biz.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Link
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="p-4">
                        <input
                          value={biz.note || ""}
                          onChange={(e) =>
                            onNoteChange(biz.placeId, e.target.value)
                          }
                          disabled={deleting}
                          className="text-sm bg-neutral-100 p-2 rounded-lg w-full min-w-[100px]"
                          placeholder="Notes..."
                        />
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => onDeleteSingle(biz.placeId)}
                          disabled={deleting}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-neutral-400">
                    {leads.length === 0
                      ? "No leads yet. Run a search to get started."
                      : "No leads match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <LeadsTablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          pageSize={LEADS_PAGE_SIZE}
          onPageChange={setPage}
          disabled={deleting}
        />
      </section>
    </>
  );
}
