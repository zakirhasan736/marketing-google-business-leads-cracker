import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { getDatabasePath } from "@/server/config/env";
import { LEADS_TABLE_SCHEMA, HEATMAP_REPORTS_TABLE_SCHEMA, SITE_AUDIT_REPORTS_TABLE_SCHEMA } from "@/server/database/schema";

let db: Database.Database | null = null;

function migrateDatabase(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(leads)")
    .all() as { name: string }[];

  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has("contact_page_url")) {
    database.exec("ALTER TABLE leads ADD COLUMN contact_page_url TEXT");
  }
  if (!columnNames.has("maps_url")) {
    database.exec("ALTER TABLE leads ADD COLUMN maps_url TEXT");
  }
  if (!columnNames.has("heatmap_share_url")) {
    database.exec("ALTER TABLE leads ADD COLUMN heatmap_share_url TEXT");
  }
  if (!columnNames.has("heatmap_keyword")) {
    database.exec("ALTER TABLE leads ADD COLUMN heatmap_keyword TEXT");
  }
  if (!columnNames.has("site_audit_share_url")) {
    database.exec("ALTER TABLE leads ADD COLUMN site_audit_share_url TEXT");
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.isAbsolute(getDatabasePath())
      ? getDatabasePath()
      : path.join(process.cwd(), getDatabasePath());

    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(LEADS_TABLE_SCHEMA);
    db.exec(HEATMAP_REPORTS_TABLE_SCHEMA);
    db.exec(SITE_AUDIT_REPORTS_TABLE_SCHEMA);
    migrateDatabase(db);
  }

  return db;
}
