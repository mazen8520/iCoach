import { describe, expect, it } from "vitest";
import { domainAcceptsMail, emailProblem, emailSyntaxProblem } from "./email-check";

const dnsError = (code: string) => Object.assign(new Error(code), { code });

function resolver(mx: () => Promise<{ exchange: string; priority: number }[]>, a: string[] = []) {
  return { mx, a: async () => a };
}

describe("emailSyntaxProblem", () => {
  it("accepts ordinary addresses", () => {
    for (const email of ["coach@gmail.com", "first.last+gym@company.co.uk", "a_b@sub.domain.sa"]) {
      expect(emailSyntaxProblem(email)).toBeNull();
    }
  });

  it("rejects malformed addresses", () => {
    for (const email of [
      "coach",
      "coach@",
      "@gmail.com",
      "coach@gmail",
      "co ach@gmail.com",
      "coach@@gmail.com",
      ".coach@gmail.com",
      "co..ach@gmail.com",
      "coach@gmail.c0m",
      "coach@-x.com",
    ]) {
      expect(emailSyntaxProblem(email)).toBe("EMAIL_INVALID");
    }
  });

  it("rejects throwaway providers and their subdomains", () => {
    expect(emailSyntaxProblem("x@mailinator.com")).toBe("EMAIL_DISPOSABLE");
    expect(emailSyntaxProblem("x@inbox.yopmail.com")).toBe("EMAIL_DISPOSABLE");
    expect(emailSyntaxProblem("x@notyopmail.com")).toBeNull();
  });
});

describe("domainAcceptsMail", () => {
  it("accepts a domain with mail servers", async () => {
    const r = resolver(async () => [{ exchange: "mx.example.com", priority: 10 }]);
    expect(await domainAcceptsMail("example.com", r)).toBe(true);
  });

  it("rejects a null MX (domain declares it takes no mail)", async () => {
    const r = resolver(async () => [{ exchange: ".", priority: 0 }], ["1.2.3.4"]);
    expect(await domainAcceptsMail("example.com", r)).toBe(false);
  });

  it("rejects a domain that does not exist", async () => {
    const r = resolver(async () => Promise.reject(dnsError("ENOTFOUND")));
    expect(await domainAcceptsMail("gmial.con", r)).toBe(false);
  });

  it("falls back to an address record when there is no MX", async () => {
    const r = resolver(async () => Promise.reject(dnsError("ENODATA")), ["1.2.3.4"]);
    expect(await domainAcceptsMail("example.com", r)).toBe(true);
  });

  it("fails open when DNS itself is down", async () => {
    const r = resolver(async () => Promise.reject(dnsError("ESERVFAIL")));
    expect(await domainAcceptsMail("example.com", r)).toBe(true);
  });

  it("fails open on a slow resolver", async () => {
    const r = resolver(() => new Promise(() => {}));
    expect(await domainAcceptsMail("example.com", r, 20)).toBe(true);
  });
});

describe("emailProblem", () => {
  it("normalizes before checking and reports the first problem", async () => {
    const ok = resolver(async () => [{ exchange: "mx.example.com", priority: 10 }]);
    expect(await emailProblem("  Coach@Example.com ", ok)).toBeNull();
    expect(await emailProblem("x@yopmail.com", ok)).toBe("EMAIL_DISPOSABLE");
    const none = resolver(async () => Promise.reject(dnsError("ENOTFOUND")));
    expect(await emailProblem("coach@nowhere-at-all.com", none)).toBe("EMAIL_NO_MAIL_SERVER");
  });
});
