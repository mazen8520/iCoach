import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "./crypto";
import { ZoomError, refreshTokens, type ZoomConfig, type ZoomTokens, type ZoomUser } from "./api";

export type StoredConnection = {
  coach_id: string;
  zoom_user_id: string;
  zoom_email: string | null;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: string;
  created_at?: string;
};

export type TokenUpdate = Pick<
  StoredConnection,
  "access_token_enc" | "refresh_token_enc" | "expires_at"
>;

/** Storage for Zoom connections (Supabase in the app, in-memory in tests). */
export interface ConnectionStore {
  get(coachId: string): Promise<StoredConnection | null>;
  upsert(
    row: StoredConnection & { zoom_account_id: string | null; scope: string | null },
  ): Promise<void>;
  /** Compare-and-swap on the previous refresh token. false = another request refreshed first. */
  replaceTokens(coachId: string, previousRefreshEnc: string, next: TokenUpdate): Promise<boolean>;
  remove(coachId: string): Promise<void>;
}

export function supabaseConnectionStore(admin: SupabaseClient): ConnectionStore {
  const table = () => admin.from("zoom_connections");
  return {
    async get(coachId) {
      const { data, error } = await table()
        .select(
          "coach_id, zoom_user_id, zoom_email, access_token_enc, refresh_token_enc, expires_at, created_at",
        )
        .eq("coach_id", coachId)
        .maybeSingle();
      if (error) throw error;
      return data as StoredConnection | null;
    },
    async upsert(row) {
      const { error } = await table().upsert(row, { onConflict: "coach_id" });
      if (error) throw error;
    },
    async replaceTokens(coachId, previousRefreshEnc, next) {
      const { data, error } = await table()
        .update(next)
        .eq("coach_id", coachId)
        .eq("refresh_token_enc", previousRefreshEnc)
        .select("coach_id");
      if (error) throw error;
      return (data ?? []).length > 0;
    },
    async remove(coachId) {
      const { error } = await table().delete().eq("coach_id", coachId);
      if (error) throw error;
    },
  };
}

/** Refresh a minute early so a token never expires mid-request. */
const EXPIRY_SKEW_MS = 60_000;

function expiresAt(tokens: ZoomTokens, now: number) {
  return new Date(now + tokens.expires_in * 1000).toISOString();
}

export function encryptTokens(
  config: ZoomConfig,
  tokens: ZoomTokens,
  now = Date.now(),
): TokenUpdate {
  return {
    access_token_enc: encryptToken(tokens.access_token, config.encryptionKey),
    refresh_token_enc: encryptToken(tokens.refresh_token, config.encryptionKey),
    expires_at: expiresAt(tokens, now),
  };
}

export async function saveConnection(
  store: ConnectionStore,
  config: ZoomConfig,
  coachId: string,
  tokens: ZoomTokens,
  me: ZoomUser,
) {
  await store.upsert({
    coach_id: coachId,
    zoom_user_id: me.id,
    zoom_email: me.email ?? null,
    zoom_account_id: me.account_id ?? null,
    scope: tokens.scope ?? null,
    ...encryptTokens(config, tokens),
  });
}

/**
 * Decrypts a stored token. A token that no longer decrypts (ZOOM_TOKEN_ENCRYPTION_KEY was changed,
 * or differs between deployments) can never be used again, so the connection is dropped and the
 * coach is asked to reconnect instead of every Zoom action failing.
 */
async function readToken(
  store: ConnectionStore,
  config: ZoomConfig,
  coachId: string,
  encrypted: string,
): Promise<string> {
  try {
    return decryptToken(encrypted, config.encryptionKey);
  } catch {
    console.error("Zoom token could not be decrypted; removing the connection.");
    await store.remove(coachId);
    throw new ZoomError("ZOOM_REVOKED");
  }
}

/**
 * A usable access token for the coach, refreshing (and storing the rotated refresh token) when it
 * is expired or `force` is set. A refresh token Zoom rejects means the coach revoked access, so
 * the connection is deleted and ZOOM_REVOKED thrown.
 */
export async function getValidAccessToken(
  store: ConnectionStore,
  config: ZoomConfig,
  coachId: string,
  { force = false, now = Date.now() }: { force?: boolean; now?: number } = {},
): Promise<string> {
  const row = await store.get(coachId);
  if (!row) throw new ZoomError("ZOOM_NOT_CONNECTED");

  if (!force && new Date(row.expires_at).getTime() - EXPIRY_SKEW_MS > now) {
    return readToken(store, config, coachId, row.access_token_enc);
  }

  const refreshToken = await readToken(store, config, coachId, row.refresh_token_enc);
  let tokens: ZoomTokens;
  try {
    tokens = await refreshTokens(config, refreshToken);
  } catch (err) {
    if (err instanceof ZoomError && err.code === "ZOOM_REVOKED") {
      // A concurrent request may have rotated the refresh token just before us.
      const latest = await store.get(coachId);
      if (latest && latest.refresh_token_enc !== row.refresh_token_enc) {
        return readToken(store, config, coachId, latest.access_token_enc);
      }
      await store.remove(coachId);
    }
    throw err;
  }

  const next = encryptTokens(config, tokens, now);
  if (await store.replaceTokens(coachId, row.refresh_token_enc, next)) return tokens.access_token;

  // Lost the race: another request stored its rotated tokens first. Use those.
  const latest = await store.get(coachId);
  if (!latest) throw new ZoomError("ZOOM_NOT_CONNECTED");
  return readToken(store, config, coachId, latest.access_token_enc);
}

/**
 * Runs a Zoom API call with the coach's token. If Zoom answers 401 (token revoked or expired
 * early) the token is force-refreshed and the call retried once.
 */
export async function withZoomToken<T>(
  store: ConnectionStore,
  config: ZoomConfig,
  coachId: string,
  call: (accessToken: string) => Promise<T>,
): Promise<T> {
  const token = await getValidAccessToken(store, config, coachId);
  try {
    return await call(token);
  } catch (err) {
    if (!(err instanceof ZoomError) || err.code !== "ZOOM_REVOKED") throw err;
  }
  const fresh = await getValidAccessToken(store, config, coachId, { force: true });
  try {
    return await call(fresh);
  } catch (err) {
    if (err instanceof ZoomError && err.code === "ZOOM_REVOKED") await store.remove(coachId);
    throw err;
  }
}
