import { describe, expect, it } from "vitest";
import { randomUrlToken } from "./api";
import { appReturnPage, appReturnUrl, isAppState, stateFor } from "./app-return";

describe("Zoom connect from the mobile app", () => {
  it("marks only app attempts", () => {
    const token = randomUrlToken();
    expect(isAppState(stateFor(token))).toBe(false);
    expect(isAppState(stateFor(token, "app"))).toBe(true);
    expect(isAppState(null)).toBe(false);
    expect(isAppState("")).toBe(false);
  });

  it("never mistakes a web state token for an app one", () => {
    for (let i = 0; i < 200; i++) expect(isAppState(randomUrlToken())).toBe(false);
  });

  it("hands the result back through the app scheme", () => {
    expect(appReturnUrl("connected")).toBe("icoach://zoom?result=connected");
    expect(appReturnUrl("a b")).toBe("icoach://zoom?result=a%20b");
  });

  it("ends on an uncached page that opens the app", async () => {
    const response = appReturnPage("connected");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain('href="icoach://zoom?result=connected"');
    expect(html).toContain("Zoom is connected");
  });

  it("explains a declined or failed attempt", async () => {
    expect(await appReturnPage("denied").text()).toContain("Zoom wasn't connected");
    expect(await appReturnPage("expired").text()).toContain("Couldn't connect Zoom");
  });
});
