import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_ATHLETE_PASSWORD } from "./account";

const inputSchema = z.object({
  accessToken: z.string().min(1),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  age: z.number().int().min(1).max(119).optional(),
  sex: z.enum(["male", "female", "other"]).optional(),
  heightCm: z.number().positive().max(299).optional(),
  weightKg: z.number().positive().max(500).optional(),
});

/**
 * Coach-only: creates a real Supabase Auth account for an athlete with the default temporary
 * password (see DEFAULT_ATHLETE_PASSWORD — the coach never types a password), sets their profile
 * (role=client, biometrics), links them to the calling coach, and optionally logs their starting
 * weight — all server-side with the service-role key, which never reaches the browser.
 *
 * The athlete role and the forced password change are written to app_metadata, which only the
 * service role can modify: the handle_new_user trigger derives the profile role from it, and the
 * app refuses every page except /reset-password until the athlete replaces the temporary password.
 *
 * Every step after account creation is wrapped so a failure anywhere rolls the whole thing back
 * (deleting the auth user cascades the profile/link/weight entry via FK) instead of leaving a
 * half-created athlete. Errors are thrown as stable codes the UI translates.
 */
export const createAthleteAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = inputSchema.safeParse(data);
    if (!parsed.success) throw new Error("INVALID_INPUT");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
    const anonKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    const secretKey = process.env["SUPABASE_SECRET_KEY"];
    if (!supabaseUrl || !anonKey || !secretKey) {
      throw new Error("SERVER_CONFIG");
    }

    // 1. Verify the caller's session token is real (cryptographically checked by Supabase Auth).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerUser, error: callerError } = await callerClient.auth.getUser(
      data.accessToken,
    );
    if (callerError || !callerUser.user) {
      throw new Error("SESSION_EXPIRED");
    }

    // 2. Re-check the caller's role against their own row via RLS — never trust a
    //    client-supplied role/coachId.
    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("id, role")
      .eq("id", callerUser.user.id)
      .single();
    if (profileError || callerProfile?.role !== "coach") {
      throw new Error("NOT_COACH");
    }
    const coachId = callerProfile.id;

    // 3. Privileged operations from here on — service-role client, server-only.
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: data.email,
      password: DEFAULT_ATHLETE_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
      app_metadata: { role: "client", must_change_password: true },
    });
    if (createError || !created.user) {
      if (createError?.code === "email_exists" || createError?.code === "user_already_exists") {
        throw new Error("EMAIL_EXISTS");
      }
      if (createError?.code === "weak_password") {
        throw new Error("WEAK_PASSWORD");
      }
      throw new Error(createError?.message || "CREATE_FAILED");
    }
    const athleteId = created.user.id;

    try {
      // role is also derived from app_metadata by a database trigger; setting it here too means
      // the account is an athlete even if that trigger were ever missing.
      const { error: updateError } = await admin
        .from("profiles")
        .update({
          role: "client",
          age: data.age ?? null,
          sex: data.sex ?? null,
          height_cm: data.heightCm ?? null,
        })
        .eq("id", athleteId);
      if (updateError) throw updateError;

      // Upsert on client_id: if another coach had left a pending email invite that the signup
      // trigger just claimed, the coach creating the account is the one the athlete belongs to.
      const { error: linkError } = await admin.from("coach_clients").upsert(
        {
          coach_id: coachId,
          client_id: athleteId,
          invited_email: null,
          joined_at: new Date().toISOString(),
        },
        { onConflict: "client_id" },
      );
      if (linkError) throw linkError;

      if (data.weightKg) {
        const { error: weightError } = await admin.from("progress_entries").insert({
          client_id: athleteId,
          entry_date: new Date().toISOString().slice(0, 10),
          weight_kg: data.weightKg,
        });
        if (weightError) throw weightError;
      }
    } catch (err) {
      // Roll back: delete the auth user so no half-created athlete is left behind.
      // FK cascades clean up the profile/link/weight-entry rows automatically.
      await admin.auth.admin.deleteUser(athleteId);
      const message = err instanceof Error ? err.message : "";
      throw new Error(message || "SETUP_FAILED");
    }

    return {
      id: athleteId,
      email: data.email,
      fullName: data.fullName,
      temporaryPassword: DEFAULT_ATHLETE_PASSWORD,
    };
  });
