export const LEADS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS leads (
    place_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT 'N/A',
    website TEXT NOT NULL DEFAULT 'N/A',
    email TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    note TEXT,
    search_category TEXT,
    search_location TEXT,
    contact_page_url TEXT,
    maps_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;
