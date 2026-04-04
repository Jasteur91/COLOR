/**
 * Applique la migration SQL sur Postgres Supabase.
 * Prérequis : DATABASE_URL (onglet Database → URI, mode session ou direct).
 * Usage : npm run db:apply
 * Ne commite jamais DATABASE_URL.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const k = m[1];
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* pas de .env.local */
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL manquant. Dans Supabase : Project Settings → Database → Connection string (URI).\n" +
      "Ajoute-le dans .env.local puis relance : npm run db:apply"
  );
  process.exit(1);
}

const sqlPath = join(root, "supabase", "migrations", "001_multiplayer.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new Client({
  connectionString: url,
  ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  await client.query(sql);
  console.log("Migration appliquée avec succès.");
} catch (e) {
  const msg = String(e?.message ?? e);
  if (msg.includes("already member") || msg.includes("duplicate")) {
    console.warn(
      "Tables / policies peut-être déjà présentes. Vérifie Realtime (publication) dans le dashboard si besoin.\n",
      msg
    );
  } else {
    console.error(e);
    process.exit(1);
  }
} finally {
  await client.end();
}
