import type { Lead } from "@/lib/types";

export async function fetchLeads(): Promise<Lead[]> {
  const response = await fetch("/api/leads");
  if (!response.ok) throw new Error("Failed to fetch leads");
  const data = await response.json();
  return data.leads;
}

export async function searchBusinesses(params: {
  category: string;
  location: string;
  country: string;
  state: string;
  zip: string;
}): Promise<{ leads: Lead[]; newCount: number }> {
  const response = await fetch("/api/search-businesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Search failed");
  }

  return { leads: data.leads, newCount: data.newCount };
}

export async function updateLeadApi(
  placeId: string,
  updates: Partial<Pick<Lead, "status" | "note" | "email">>
): Promise<Lead> {
  const response = await fetch(`/api/leads/${encodeURIComponent(placeId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Update failed");
  return data.lead;
}

export async function deleteLeadsApi(
  placeIds: string[]
): Promise<{ deleted: number; leads: Lead[] }> {
  const response = await fetch("/api/leads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeIds }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Delete failed");
  }
  return { deleted: data.deleted, leads: data.leads };
}

export async function deleteAllLeadsApi(): Promise<{
  deleted: number;
  leads: Lead[];
}> {
  const response = await fetch("/api/leads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleteAll: true }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Delete all failed");
  }
  return { deleted: data.deleted, leads: data.leads };
}

export async function deleteLeadApi(placeId: string): Promise<void> {
  const response = await fetch(`/api/leads/${encodeURIComponent(placeId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Delete failed");
  }
}

export async function findMissingEmails(
  leads: Lead[],
  options?: { retries?: number }
): Promise<{
  updatedLeads: Lead[];
  emailsFound: number;
  contactFormsFound: number;
  markedNoEmail: number;
  processed: number;
  skipped: number;
}> {
  const retries = options?.retries ?? 2;
  let lastError: Error | null = null;
  const placeIds = leads.map((lead) => lead.placeId);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("/api/leads/find-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeIds }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const status = response.status;
        throw new Error(
          status === 504
            ? "Email scan timed out on the server. Retrying…"
            : `Email scan failed (${status}). Server did not return JSON.`
        );
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Email search failed");
      }

      return {
        updatedLeads: data.updatedLeads ?? data.leads ?? [],
        emailsFound: data.emailsFound ?? 0,
        contactFormsFound: data.contactFormsFound ?? 0,
        markedNoEmail: data.markedNoEmail ?? 0,
        processed: data.processed ?? 0,
        skipped: data.skipped ?? 0,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Email search failed");
      const isRetryable =
        attempt < retries &&
        (lastError.message.includes("timed out") ||
          lastError.message.includes("504") ||
          lastError.message.includes("Failed to fetch"));

      if (!isRetryable) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Email search failed");
}

export async function exportLeadsApi(placeIds: string[]): Promise<{
  leads: Lead[];
  markedCollected: number;
  markedNoEmail: number;
}> {
  const response = await fetch("/api/leads/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeIds }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Export failed");
  return {
    leads: data.leads,
    markedCollected: data.markedCollected ?? 0,
    markedNoEmail: data.markedNoEmail ?? 0,
  };
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    return data.googleMapsConfigured === true;
  } catch {
    return false;
  }
}
