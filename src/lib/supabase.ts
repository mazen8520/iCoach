import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"];
const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!url || !publishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill in your Supabase project credentials.",
  );
}

// Not parameterized with the generated Database type: this project's schema types
// (src/lib/database.types.ts) are hand-written and don't carry the FK relationship
// metadata Postgrest needs to type embedded `select("*, table(...)")` joins, which
// otherwise collapses inferred row types to `never`. Row/Insert shapes from
// database.types.ts are used directly at call sites for typing instead.
export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
