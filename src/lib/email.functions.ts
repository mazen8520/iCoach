import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { emailProblem } from "./server/email-check";

const inputSchema = z.object({ email: z.string().trim().max(254) });

/**
 * Checks an address before an account is created for it: well-formed, not a throwaway-inbox
 * provider, and on a domain that can actually receive mail (DNS MX lookup, server-side because
 * browsers can't query DNS). Returns the problem code, or null when the address looks real.
 * The confirmation email Supabase sends next is what finally proves the inbox belongs to them.
 */
export const verifyEmailAddress = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = inputSchema.safeParse(data);
    if (!parsed.success) throw new Error("INVALID_INPUT");
    return parsed.data;
  })
  .handler(async ({ data }) => ({ problem: await emailProblem(data.email) }));
