import { getDatabase } from "@/server/database/client";
import type { Lead, LeadStatus } from "@/lib/types";

interface LeadRow {
  place_id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  email: string | null;
  status: string;
  note: string | null;
  search_category: string | null;
  search_location: string | null;
  contact_page_url: string | null;
  maps_url: string | null;
  created_at: string;
  updated_at: string;
}

function rowToLead(row: LeadRow): Lead {
  return {
    placeId: row.place_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    website: row.website,
    email: row.email,
    status: row.status as LeadStatus,
    note: row.note,
    searchCategory: row.search_category,
    searchLocation: row.search_location,
    contactPageUrl: row.contact_page_url,
    mapsUrl: row.maps_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllLeads(): Lead[] {
  const rows = getDatabase()
    .prepare("SELECT * FROM leads ORDER BY created_at DESC")
    .all() as LeadRow[];
  return rows.map(rowToLead);
}

export function getLeadByPlaceId(placeId: string): Lead | null {
  const row = getDatabase()
    .prepare("SELECT * FROM leads WHERE place_id = ?")
    .get(placeId) as LeadRow | undefined;
  return row ? rowToLead(row) : null;
}

export function upsertLead(
  lead: Omit<Lead, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  }
): Lead {
  const now = new Date().toISOString();
  const existing = getLeadByPlaceId(lead.placeId);

  if (existing) {
    getDatabase()
      .prepare(
        `UPDATE leads SET
          name = ?,
          address = ?,
          phone = ?,
          website = ?,
          email = COALESCE(?, email),
          search_category = COALESCE(?, search_category),
          search_location = COALESCE(?, search_location),
          maps_url = COALESCE(?, maps_url),
          updated_at = ?
        WHERE place_id = ?`
      )
      .run(
        lead.name,
        lead.address,
        lead.phone,
        lead.website,
        lead.email ?? null,
        lead.searchCategory ?? null,
        lead.searchLocation ?? null,
        lead.mapsUrl ?? null,
        now,
        lead.placeId
      );
    return getLeadByPlaceId(lead.placeId)!;
  }

  getDatabase()
    .prepare(
      `INSERT INTO leads (
        place_id, name, address, phone, website, email, status, note,
        search_category, search_location, contact_page_url, maps_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      lead.placeId,
      lead.name,
      lead.address,
      lead.phone,
      lead.website,
      lead.email ?? null,
      lead.status ?? "New",
      lead.note ?? null,
      lead.searchCategory ?? null,
      lead.searchLocation ?? null,
      lead.contactPageUrl ?? null,
      lead.mapsUrl ?? null,
      now,
      now
    );

  return getLeadByPlaceId(lead.placeId)!;
}

export function updateLead(
  placeId: string,
  updates: Partial<Pick<Lead, "status" | "note" | "email" | "contactPageUrl">>
): Lead | null {
  const existing = getLeadByPlaceId(placeId);
  if (!existing) return null;

  const now = new Date().toISOString();
  getDatabase()
    .prepare(
      `UPDATE leads SET
        status = COALESCE(?, status),
        note = COALESCE(?, note),
        email = COALESCE(?, email),
        contact_page_url = COALESCE(?, contact_page_url),
        updated_at = ?
      WHERE place_id = ?`
    )
    .run(
      updates.status ?? null,
      updates.note ?? null,
      updates.email ?? null,
      updates.contactPageUrl ?? null,
      now,
      placeId
    );

  return getLeadByPlaceId(placeId);
}

export function deleteLead(placeId: string): boolean {
  const result = getDatabase()
    .prepare("DELETE FROM leads WHERE place_id = ?")
    .run(placeId);
  return result.changes > 0;
}

export function deleteLeads(placeIds: string[]): number {
  if (placeIds.length === 0) return 0;
  const placeholders = placeIds.map(() => "?").join(", ");
  const result = getDatabase()
    .prepare(`DELETE FROM leads WHERE place_id IN (${placeholders})`)
    .run(...placeIds);
  return result.changes;
}

export function deleteAllLeads(): number {
  const result = getDatabase().prepare("DELETE FROM leads").run();
  return result.changes;
}

export function getExistingPlaceIds(): Set<string> {
  const rows = getDatabase()
    .prepare("SELECT place_id FROM leads")
    .all() as { place_id: string }[];
  return new Set(rows.map((r) => r.place_id));
}
