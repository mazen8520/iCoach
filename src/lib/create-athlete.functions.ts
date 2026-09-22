import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const inputSchema = z.object({
  accessToken: z.string().min(1),
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  age: z.number().int().min(1).max(119).optional(),
  sex: z.enum(["male", "female", "other"]).optional(),
  heightCm: z.number().positive().max(299).optional(),
  weightKg: z.number().positive().max(500).optional(),
});

/**
 * Coach-only: creates a real Supabase Auth account for an athlete, sets their profile
 * (role=client, biometrics), links them to the calling coach, and optionally logs their
 * starting weight — all server-side with the service-role key, which never reaches the
 * browser. Every step after account creation is wrapped so a failure anywhere rolls the
 * whole thing back (deleting the auth user cascades the profile/link/weight entry via FK),
 * instead of leaving a half-created athlete.
 */
export const createAthleteAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
    const anonKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    const secretKey = process.env["SUPABASE_SECRET_KEY"];
    if (!supabaseUrl || !anonKey || !secretKey) {
      throw new Error("Server is missing Supabase configuration.");
    }

    // 1. Verify the caller's session token is real (cryptographically checked by Supabase Auth).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: callerUser, error: callerError } = await callerClient.auth.getUser(
      data.accessToken,
    );
    if (callerError || !callerUser.user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    // 2. Re-check the caller's role against their own row via RLS — never trust a
    //    client-supplied role/coachId.
    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("id, role")
      .eq("id", callerUser.user.id)
      .single();
    if (profileError || callerProfile?.role !== "coach") {
      throw new Error("Only coaches can add athletes.");
    }
    const coachId = callerProfile.id;

    // 3. Privileged operations from here on — service-role client, server-only.
    const admin = createClient(supabaseUrl, secretKey);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: "client" },
    });
    if (createError || !created.user) {
      if (createError?.code === "email_exists" || createError?.status === 422) {
        throw new Error("An account with this email already exists.");
      }
      throw new Error(createError?.message || "Couldn't create the athlete's account.");
    }
    const athleteId = created.user.id;

    try {
      const { error: updateError } = await admin
        .from("profiles")
        .update({
          age: data.age ?? null,
          sex: data.sex ?? null,
          height_cm: data.heightCm ?? null,
        })
        .eq("id", athleteId);
      if (updateError) throw updateError;

      const { error: linkError } = await admin
        .from("coach_clients")
        .insert({ coach_id: coachId, client_id: athleteId, joined_at: new Date().toISOString() });
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
      const message =
        err instanceof Error ? err.message : "Couldn't finish setting up the athlete.";
      throw new Error(message);
    }

    return { id: athleteId, email: data.email, fullName: data.fullName };
  });
