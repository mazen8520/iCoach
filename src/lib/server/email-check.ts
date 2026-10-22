import { DISPOSABLE_EMAIL_DOMAINS } from "./disposable-domains";

/** Why an address was refused. Thrown to the browser as these exact codes. */
export type EmailProblem = "EMAIL_INVALID" | "EMAIL_DISPOSABLE" | "EMAIL_NO_MAIL_SERVER";

// Stricter than "something@something.something": one @, no spaces or quotes, a real-looking
// domain with a letters-only top-level label of 2+ characters.
const ADDRESS =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function emailDomain(email: string) {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

/** Format and throwaway-provider checks — no network. */
export function emailSyntaxProblem(email: string): EmailProblem | null {
  if (email.length > 254 || !ADDRESS.test(email)) return "EMAIL_INVALID";
  const local = email.slice(0, email.lastIndexOf("@"));
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return "EMAIL_INVALID";
  }
  const domain = emailDomain(email);
  // Covers subdomains too (anything.mailinator.com).
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(labels.slice(i).join("."))) return "EMAIL_DISPOSABLE";
  }
  return null;
}

type Resolver = {
  mx: (domain: string) => Promise<{ exchange: string; priority: number }[]>;
  a: (domain: string) => Promise<string[]>;
};

const dnsError = (code: string) => Object.assign(new Error(`DNS ${code}`), { code });

// DNS over HTTPS rather than the runtime's own resolver: serverless runtimes (and some networks)
// block or mangle raw DNS, and an HTTPS lookup behaves the same everywhere. Only the domain is
// sent — never the full address. Google answers if Cloudflare can't.
const DOH_ENDPOINTS = ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"];
const DNS_TYPES = { MX: 15, A: 1, AAAA: 28 } as const;

async function dohLookup(name: string, type: keyof typeof DNS_TYPES): Promise<string[]> {
  for (const endpoint of DOH_ENDPOINTS) {
    let body: { Status?: number; Answer?: { type: number; data: string }[] };
    try {
      const res = await fetch(`${endpoint}?name=${encodeURIComponent(name)}&type=${type}`, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      body = await res.json();
    } catch {
      continue;
    }
    if (body.Status === 3) throw dnsError("ENOTFOUND"); // NXDOMAIN: the domain doesn't exist.
    if (body.Status !== 0) continue;
    return (body.Answer ?? []).filter((a) => a.type === DNS_TYPES[type]).map((a) => a.data);
  }
  throw dnsError("ESERVFAIL");
}

const systemResolver: Resolver = {
  mx: async (domain) => {
    const records = (await dohLookup(domain, "MX")).map((data) => {
      const [priority = "0", host = ""] = data.split(" ");
      return { priority: Number(priority), exchange: host === "." ? "." : host.replace(/.$/, "") };
    });
    if (records.length === 0) throw dnsError("ENODATA");
    return records;
  },
  a: async (domain) => {
    const [v4, v6] = await Promise.allSettled([dohLookup(domain, "A"), dohLookup(domain, "AAAA")]);
    if (v4.status === "rejected" && v6.status === "rejected") throw v4.reason;
    return [
      ...(v4.status === "fulfilled" ? v4.value : []),
      ...(v6.status === "fulfilled" ? v6.value : []),
    ];
  },
};

// The domain answered, and the answer was "no such domain" / "no records of that type".
const DEFINITE_MISS = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("DNS timeout"), { code: "ETIMEOUT" })), ms),
    ),
  ]);
}

function lookupFailed(domain: string, code: string) {
  console.warn(`[email-check] DNS lookup for ${domain} failed (${code || "unknown"}); allowing`);
  return true;
}

/** Whether the domain can receive email at all: it publishes mail servers (MX), or — the rare
 *  RFC 5321 fallback — has an address record mail can be delivered to. A domain whose MX is the
 *  "null MX" (RFC 7505) has declared it accepts no mail. DNS outages fail open: the
 *  confirmation email that follows sign-up is still the final proof the inbox is real. */
export async function domainAcceptsMail(
  domain: string,
  resolver: Resolver = systemResolver,
  timeoutMs = 3000,
): Promise<boolean> {
  try {
    const records = await withTimeout(resolver.mx(domain), timeoutMs);
    const usable = records.filter((r) => r.exchange && r.exchange !== ".");
    if (usable.length > 0) return true;
    if (records.length > 0) return false; // Only a null MX.
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "ENOTFOUND" || code === "NXDOMAIN") return false;
    if (!DEFINITE_MISS.has(code)) return lookupFailed(domain, code);
  }
  try {
    return (await withTimeout(resolver.a(domain), timeoutMs)).length > 0;
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    return DEFINITE_MISS.has(code) ? false : lookupFailed(domain, code);
  }
}

/** Full check used before any account is created. Returns null when the address looks real. */
export async function emailProblem(
  email: string,
  resolver?: Resolver,
): Promise<EmailProblem | null> {
  const normalized = email.trim().toLowerCase();
  const syntax = emailSyntaxProblem(normalized);
  if (syntax) return syntax;
  return (await domainAcceptsMail(emailDomain(normalized), resolver))
    ? null
    : "EMAIL_NO_MAIL_SERVER";
}
