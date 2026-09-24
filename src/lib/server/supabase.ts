import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env() {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const anonKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  const secretKey = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !anonKey || !secretKey) throw new Error("SERVER_CONFIG");
  return { url, anonKey, secretKey };
}

const noSession = { persistSession: false, autoRefreshToken: false };

/** Service-role client: bypasses RLS. Server-only. */
export function adminClient(): SupabaseClient {
  const { url, secretKey } = env();
  return createClient(url, secretKey, { auth: noSession });
}

/**
 * Verifies the caller's Supabase access token and that their profile role is coach. Returns a
 * client acting as that coach, so reads and writes through it stay subject to RLS.
 */
export async function requireCoach(
  accessToken: string,
): Promise<{ coachId: string; db: SupabaseClient }> {
  const { url, anonKey } = env();
  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: noSession,
  });
  const { data: user, error } = await db.auth.getUser(accessToken);
  if (error || !user.user) throw new Error("SESSION_EXPIRED");
  const { data: profile } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", user.user.id)
    .single();
  if (profile?.role !== "coach") throw new Error("NOT_COACH");
  return { coachId: profile.id as string, db };
}
