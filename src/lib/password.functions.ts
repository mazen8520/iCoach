import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_ATHLETE_PASSWORD, MIN_PASSWORD_LENGTH, mustChangePassword } from "./account";

const inputSchema = z.object({
  accessToken: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(72),
});

/**
 * Completes the forced first-login password change for a coach-created athlete. It has to run
 * server-side because the must_change_password flag lives in app_metadata, which only the
 * service role can clear — so an athlete can't skip the change by editing their own metadata.
 * The caller must re-fetch their session afterwards to pick up the cleared flag.
 */
export const completeRequiredPasswordChange = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = inputSchema.safeParse(data);
    if (!parsed.success) throw new Error("INVALID_INPUT");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
    const secretKey = process.env["SUPABASE_SECRET_KEY"];
    if (!supabaseUrl || !secretKey) {
      throw new Error("SERVER_CONFIG");
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify the caller's token with Supabase Auth; never trust a client-supplied user id.
    const { data: caller, error: callerError } = await admin.auth.getUser(data.accessToken);
    if (callerError || !caller.user) {
      throw new Error("SESSION_EXPIRED");
    }
    if (!mustChangePassword(caller.user)) {
      throw new Error("PASSWORD_CHANGE_NOT_REQUIRED");
    }
    if (data.password === DEFAULT_ATHLETE_PASSWORD) {
      throw new Error("PASSWORD_SAME_AS_TEMPORARY");
    }

    const { error } = await admin.auth.admin.updateUserById(caller.user.id, {
      password: data.password,
      app_metadata: { must_change_password: false },
      user_metadata: { must_change_password: false },
    });
    if (error) {
      if (error.code === "weak_password") throw new Error("WEAK_PASSWORD");
      if (error.code === "same_password") throw new Error("PASSWORD_SAME_AS_TEMPORARY");
      throw new Error(error.message || "PASSWORD_UPDATE_FAILED");
    }

    return { ok: true as const };
  });
