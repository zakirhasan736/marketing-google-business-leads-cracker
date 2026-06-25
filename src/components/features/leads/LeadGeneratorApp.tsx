"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LeadModal } from "@/components/features/leads/LeadModal";
import { SiteAuditModal } from "@/components/features/leads/SiteAuditModal";
import { LeadSearchForm } from "@/components/features/leads/LeadSearchForm";
import { LeadsTable } from "@/components/features/leads/LeadsTable";
import { RecentSearchesSidebar } from "@/components/features/leads/RecentSearchesSidebar";
import { MessageHub } from "@/components/features/messages/MessageHub";
import {
  checkHealth,
  deleteAllLeadsApi,
  deleteLeadApi,
  deleteLeadsApi,
  exportLeadsApi,
  fetchLeads,
  findMissingEmails,
  searchBusinesses,
  updateLeadApi,
} from "@/lib/api/leads.client";
import { categories } from "@/lib/constants/geo-data";
import { EMAIL_SCAN_BATCH_SIZE } from "@/lib/constants/lead-status";
import { ALL_CATEGORIES_LABEL, type Lead, type LeadStatus, type RecentSearch } from "@/lib/types";
import { downloadCsv, leadsNeedingEmailScan, leadsToRescanEmail, mergeLeadUpdates, leadsToCsv } from "@/lib/utils/export-leads";

type View = "search" | "messages";

export function LeadGeneratorApp() {
  const [apiConfigured, setApiConfigured] = useState<boolean>(true);
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [view, setView] = useState<View>("search");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [activeModalLead, setActiveModalLead] = useState<Lead | null>(null);
  const [activeAuditLead, setActiveAuditLead] = useState<Lead | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [progress, setProgress] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [batchLabel, setBatchLabel] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string>("idle");
  const stopSearchRef = useRef(false);
  const stopEmailScanRef = useRef(false);

  const showSnackbar = useCallback((message: string) => {
    setSnackbar({ open: true, message });
    setTimeout(() => setSnackbar({ open: false, message: "" }), 3000);
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      const data = await fetchLeads();
      setLeads(data);
    } catch (error) {
      console.error("Failed to load leads:", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const configured = await Promise.race([
          checkHealth(),
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(true), 4000)
          ),
        ]);
        if (!cancelled) setApiConfigured(configured);
      } catch {
        if (!cancelled) setApiConfigured(true);
      }

      if (!cancelled) loadLeads();

      const stored = localStorage.getItem("recentSearches");
      if (stored && !cancelled) {
        try {
          setRecentSearches(JSON.parse(stored));
        } catch {
          // ignore invalid storage
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadLeads]);

  const deleteRecentSearch = (index: number) => {
    const updated = recentSearches.filter((_, i) => i !== index);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  const toggleLead = (placeId: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  };

  const toggleSelectionForLeads = (targetLeads: Lead[]) => {
    if (targetLeads.length === 0) return;
    const allSelected = targetLeads.every((l) => selectedLeads.has(l.placeId));
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        targetLeads.forEach((l) => next.delete(l.placeId));
      } else {
        targetLeads.forEach((l) => next.add(l.placeId));
      }
      return next;
    });
  };

  const selectAllLeads = () => {
    setSelectedLeads(new Set(leads.map((l) => l.placeId)));
  };

  const clearSelection = () => {
    setSelectedLeads(new Set());
  };

  const updateLeadStatus = async (placeId: string, status: LeadStatus) => {
    const updated = await updateLeadApi(placeId, { status });
    setLeads((prev) =>
      prev.map((l) => (l.placeId === placeId ? updated : l))
    );
  };

  const updateNote = async (placeId: string, note: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.placeId === placeId ? { ...l, note } : l))
    );

    try {
      await updateLeadApi(placeId, { note });
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  };

  const handleLeadUpdated = (placeId: string, updates: Partial<Lead>) => {
    setLeads((prev) =>
      prev.map((l) => (l.placeId === placeId ? { ...l, ...updates } : l))
    );
    setActiveModalLead((current) =>
      current?.placeId === placeId ? { ...current, ...updates } : current
    );
    setActiveAuditLead((current) =>
      current?.placeId === placeId ? { ...current, ...updates } : current
    );
  };

  const updateEmail = async (placeId: string, email: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.placeId === placeId ? { ...l, email: email || null } : l
      )
    );

    try {
      const updated = await updateLeadApi(placeId, { email: email || "" });
      setLeads((prev) =>
        prev.map((l) => (l.placeId === placeId ? updated : l))
      );
    } catch (error) {
      console.error("Failed to save email:", error);
      showSnackbar("Failed to save email.");
    }
  };

  const deleteSelected = async () => {
    const placeIds = Array.from(selectedLeads);
    if (placeIds.length === 0) return;

    if (
      !window.confirm(
        `Permanently delete ${placeIds.length} lead(s) from the database? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const { deleted, leads: updated } = await deleteLeadsApi(placeIds);
      setLeads(updated);
      setSelectedLeads(new Set());
      showSnackbar(`Permanently deleted ${deleted} lead(s) from database.`);
    } catch (error) {
      console.error(error);
      showSnackbar("Failed to delete leads.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteAllFromDatabase = async () => {
    if (leads.length === 0) return;

    if (
      !window.confirm(
        `Permanently delete ALL ${leads.length} lead(s) from the database? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const { deleted, leads: updated } = await deleteAllLeadsApi();
      setLeads(updated);
      setSelectedLeads(new Set());
      showSnackbar(`Permanently deleted all ${deleted} lead(s) from database.`);
    } catch (error) {
      console.error(error);
      showSnackbar("Failed to delete all leads.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteSingle = async (placeId: string) => {
    const lead = leads.find((l) => l.placeId === placeId);
    if (
      !window.confirm(
        `Permanently delete "${lead?.name ?? "this lead"}" from the database?`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      await deleteLeadApi(placeId);
      setLeads((prev) => prev.filter((l) => l.placeId !== placeId));
      setSelectedLeads((prev) => {
        const next = new Set(prev);
        next.delete(placeId);
        return next;
      });
      showSnackbar("Lead permanently deleted from database.");
    } catch (error) {
      console.error(error);
      showSnackbar("Failed to delete lead.");
    } finally {
      setDeleting(false);
    }
  };

  const handleStopEmailScan = () => {
    stopEmailScanRef.current = true;
    setBatchLabel("Stopping email scan after current batch...");
  };

  const handleFindMissingEmails = async (rescanNoEmail = false) => {
    const toScan = rescanNoEmail
      ? leadsToRescanEmail(leads)
      : leadsNeedingEmailScan(leads);

    if (toScan.length === 0) {
      const alreadyNoEmail = leads.filter((l) => l.status === "No Email").length;
      showSnackbar(
        rescanNoEmail
          ? "No No Email leads with a website to rescan."
          : alreadyNoEmail > 0
            ? `Nothing new to scan. ${alreadyNoEmail.toLocaleString()} lead(s) already marked No Email — use Rescan if needed.`
            : "No leads missing email."
      );
      return;
    }

    stopEmailScanRef.current = false;
    setLoading(true);

    let totalFound = 0;
    let totalContactForms = 0;
    let totalNoEmail = 0;
    let totalProcessed = 0;
    let failedBatches = 0;
    const MAX_FAILED_BATCHES = 10;

    try {
      for (let i = 0; i < toScan.length; i += EMAIL_SCAN_BATCH_SIZE) {
        if (stopEmailScanRef.current) break;

        const batch = toScan.slice(i, i + EMAIL_SCAN_BATCH_SIZE);
        const batchEnd = Math.min(i + EMAIL_SCAN_BATCH_SIZE, toScan.length);
        setBatchLabel(
          `${rescanNoEmail ? "Rescanning" : "Finding emails"} ${batchEnd.toLocaleString()} / ${toScan.length.toLocaleString()} · ${totalFound} found`
        );

        try {
          const result = await findMissingEmails(batch);
          setLeads((prev) => mergeLeadUpdates(prev, result.updatedLeads));
          totalFound += result.emailsFound;
          totalContactForms += result.contactFormsFound;
          totalNoEmail += result.markedNoEmail;
          totalProcessed += result.processed;
          failedBatches = 0;

          if (batchEnd % 25 === 0) {
            try {
              setLeads(await fetchLeads());
            } catch {
              // keep merged state
            }
          }
        } catch (batchError) {
          failedBatches++;
          console.error(batchError);
          try {
            setLeads(await fetchLeads());
          } catch {
            // keep current list
          }
          if (failedBatches >= MAX_FAILED_BATCHES) {
            throw batchError;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      if (stopEmailScanRef.current) {
        showSnackbar(
          `Email scan stopped. ${totalFound} collected, ${totalProcessed.toLocaleString()} processed.`
        );
      } else {
        showSnackbar(
          totalContactForms > 0
            ? `Done. ${totalFound} email(s) found, ${totalProcessed.toLocaleString()} processed. ${totalContactForms} contact form(s).`
            : `Done. ${totalFound} email(s) found, ${totalProcessed.toLocaleString()} processed.`
        );
      }
    } catch (error) {
      console.error(error);
      try {
        setLeads(await fetchLeads());
      } catch {
        // keep current list if refresh fails
      }
      const message =
        error instanceof Error ? error.message : "Email search failed.";
      showSnackbar(
        totalProcessed > 0
          ? `Scan paused after ${totalProcessed.toLocaleString()} lead(s). ${message} Click again to continue remaining leads.`
          : message
      );
    } finally {
      setLoading(false);
      setBatchLabel(null);
    }
  };

  const handleExportLeads = async (leadsToExport: Lead[]) => {
    if (leadsToExport.length === 0) {
      showSnackbar("Nothing to export.");
      return;
    }

    setLoading(true);
    try {
      const placeIds = leadsToExport.map((l) => l.placeId);
      const { leads: updated, markedCollected, markedNoEmail } =
        await exportLeadsApi(placeIds);

      const exported = placeIds
        .map((id) => updated.find((l) => l.placeId === id))
        .filter((l): l is Lead => l !== undefined);

      const csv = leadsToCsv(exported);
      downloadCsv(csv, `leads-export-${new Date().toISOString().slice(0, 10)}.csv`);
      setLeads(updated);
      showSnackbar(
        `Exported ${exported.length} lead(s). ${markedCollected} → Collected, ${markedNoEmail} → No Email.`
      );
    } catch (error) {
      console.error(error);
      showSnackbar("Export failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleStopSearch = () => {
    stopSearchRef.current = true;
    setBatchLabel("Stopping after current category...");
  };

  const handleSearch = async (selectedCategories: string[]) => {
    if (selectedCategories.length === 0) {
      showSnackbar("Select at least one category to search.");
      return;
    }

    stopSearchRef.current = false;
    setLoading(true);
    setSearchStatus("searching");
    setProgress(0);

    const location = `${zip}, ${state}, ${country}`;
    const totalCategories = selectedCategories.length;
    let totalNew = 0;
    let completed = 0;

    try {
      for (let i = 0; i < totalCategories; i++) {
        if (stopSearchRef.current) break;

        const cat = selectedCategories[i];
        const label = `Searching ${cat} (${i + 1}/${totalCategories})`;
        setBatchLabel(label);
        setSearchStatus(label);
        setProgress(Math.round((i / totalCategories) * 100));

        try {
          const { leads: updatedLeads, newCount } = await searchBusinesses({
            category: cat,
            location,
            country,
            state,
            zip,
          });
          setLeads(updatedLeads);
          totalNew += newCount;
          completed++;
        } catch (error) {
          console.error(`Error searching ${cat}:`, error);
        }

        if (stopSearchRef.current) break;

        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      setProgress(100);
      setSearchStatus("complete");

      const categoryLabel =
        totalCategories === categories.length
          ? ALL_CATEGORIES_LABEL
          : `${totalCategories} categories`;

      if (stopSearchRef.current) {
        showSnackbar(
          `Search stopped. ${completed}/${totalCategories} categories done, ${totalNew} new lead(s).`
        );
      } else {
        showSnackbar(
          `${totalCategories} categor${totalCategories === 1 ? "y" : "ies"} searched. ${totalNew} new lead(s) added.`
        );

        const searchEntry: RecentSearch = {
          country,
          state,
          zip,
          category: categoryLabel,
          date: new Date().toISOString(),
        };
        const updatedSearches = [
          searchEntry,
          ...recentSearches.filter(
            (s) =>
              !(
                s.country === country &&
                s.state === state &&
                s.zip === zip
              )
          ),
        ].slice(0, 5);
        setRecentSearches(updatedSearches);
        localStorage.setItem("recentSearches", JSON.stringify(updatedSearches));
      }
    } catch (error) {
      console.error("Error searching:", error);
      showSnackbar(
        error instanceof Error ? error.message : "Error searching for leads."
      );
      setSearchStatus("idle");
    } finally {
      setLoading(false);
      setBatchLabel(null);
      setTimeout(() => {
        setProgress(0);
        setSearchStatus("idle");
      }, 1500);
    }
  };

  if (!apiConfigured) {
    return (
      <div className="flex items-center justify-center h-screen font-sans">
        <div className="text-center max-w-lg p-8">
          <h2 className="text-2xl font-bold mb-4">
            Google Maps API Key Required
          </h2>
          <p className="text-neutral-600 mb-4">
            The API key must be set server-side only — never exposed to the
            browser.
          </p>
          <ol className="text-left space-y-2 text-sm text-neutral-700">
            <li>
              1. Get a key from{" "}
              <a
                href="https://console.cloud.google.com/google/maps-apis/start"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Google Cloud Console
              </a>
            </li>
            <li>
              2. Enable <strong>Places API</strong> and restrict the key to
              server IPs
            </li>
            <li>
              3. Add to{" "}
              <code className="bg-neutral-100 px-1 rounded">.env.local</code>:
              <pre className="bg-neutral-100 p-3 rounded-lg mt-2 text-left">
                GOOGLE_MAPS_PLATFORM_KEY=your_key_here
              </pre>
            </li>
            <li>4. Restart the dev server</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-neutral-900">LeadGen</h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setView("search")}
            className={`text-sm font-semibold ${view === "search" ? "text-blue-600" : "text-neutral-500"}`}
          >
            Lead Search
          </button>
          <button
            onClick={() => setView("messages")}
            className={`text-sm font-semibold ${view === "messages" ? "text-blue-600" : "text-neutral-500"}`}
          >
            Message Hub
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="flex items-center gap-2 p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 transition"
          >
            <Clock size={20} /> History
          </button>
        </div>
      </header>

      <main className="flex flex-1 h-[calc(100vh-73px)]">
        <div className="flex-1 overflow-y-auto p-8 bg-neutral-50">
          {progress > 0 && (
            <div className="w-full bg-neutral-200 h-2 rounded-full mb-6 overflow-hidden">
              <motion.div
                className="bg-blue-600 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          )}

          <AnimatePresence>
            {snackbar.open && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="fixed bottom-6 right-6 bg-neutral-900 text-white p-4 rounded-xl shadow-lg z-50"
              >
                {snackbar.message}
              </motion.div>
            )}
          </AnimatePresence>

          {view === "search" ? (
            <>
              <LeadSearchForm
                country={country}
                state={state}
                zip={zip}
                loading={loading}
                batchLabel={batchLabel}
                onCountryChange={(v) => {
                  setCountry(v);
                  setState("");
                  setZip("");
                }}
                onStateChange={(v) => {
                  setState(v);
                  setZip("");
                }}
                onZipChange={setZip}
                onSearch={handleSearch}
                onStopSearch={handleStopSearch}
              />
              <LeadsTable
                leads={leads}
                selectedLeads={selectedLeads}
                loading={loading}
                deleting={deleting}
                searchStatus={searchStatus}
                batchLabel={batchLabel}
                onToggleLead={toggleLead}
                onToggleSelectionForLeads={toggleSelectionForLeads}
                onSelectAll={selectAllLeads}
                onClearSelection={clearSelection}
                onStatusChange={updateLeadStatus}
                onNoteChange={updateNote}
                onEmailChange={updateEmail}
                onDeleteSelected={deleteSelected}
                onDeleteAll={deleteAllFromDatabase}
                onDeleteSingle={deleteSingle}
                onFindMissingEmails={() => handleFindMissingEmails(false)}
                onRescanNoEmail={() => handleFindMissingEmails(true)}
                onStopEmailScan={handleStopEmailScan}
                onExportLeads={handleExportLeads}
                onLeadClick={setActiveModalLead}
                onSiteAuditClick={setActiveAuditLead}
              />
            </>
          ) : (
            <MessageHub />
          )}
        </div>

        {showSidebar && (
          <RecentSearchesSidebar
            searches={recentSearches}
            onSelect={(s) => {
              setCountry(s.country);
              setState(s.state);
              setZip(s.zip);
            }}
            onDelete={deleteRecentSearch}
          />
        )}
      </main>

      <LeadModal
        lead={activeModalLead}
        onClose={() => setActiveModalLead(null)}
        onLeadUpdated={handleLeadUpdated}
      />
      <SiteAuditModal
        lead={activeAuditLead}
        onClose={() => setActiveAuditLead(null)}
        onLeadUpdated={handleLeadUpdated}
      />
    </div>
  );
}
