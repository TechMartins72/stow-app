// The privacy policy, held to what Google checks before it lets an app with Google
// sign-in go to production, and to what the code actually does.
// https://support.google.com/cloud/answer/13806988 (OAuth app verification: privacy policy)
// https://developers.google.com/terms/api-services-user-data-policy

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config as proxyConfig } from "@/proxy";
import { startGoogleSignIn } from "@/app/_server/google-auth";
import PrivacyPage from "./page";

const render = () => renderToStaticMarkup(createElement(PrivacyPage));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** The text of the section with this id. */
function section(html: string, id: string): string {
  const start = html.indexOf(`id="${id}"`);
  if (start < 0) return "";
  const end = html.indexOf("</section>", start);
  return text(html.slice(start, end));
}

afterEach(() => vi.unstubAllEnvs());

describe("privacy policy: what Google checks", () => {
  it("is public: the sign-in check never covers it (Google's reviewers aren't signed in)", () => {
    const covers = (path: string) =>
      proxyConfig.matcher.some((m) => m === path || (m.endsWith("/:path*") && path.startsWith(m.slice(0, -"/:path*".length))));
    expect(covers("/privacy")).toBe(false);
    expect(covers("/welcome")).toBe(false);
  });

  it("names the app and says when it was last updated", () => {
    const page = text(render());
    expect(page).toMatch(/Stow/);
    expect(page).toMatch(/Last updated \d{1,2} [A-Z][a-z]+ \d{4}/);
  });

  it("has a section on Google user data covering access, use, storage, sharing and deletion", () => {
    const google = section(render(), "google-user-data");
    expect(google, "missing section with id google-user-data").not.toBe("");
    expect(google).toMatch(/access/i);
    expect(google).toMatch(/\buse\b/i);
    expect(google).toMatch(/stor(e|ed|age)/i);
    expect(google).toMatch(/shar(e|ed|ing)/i);
    expect(google).toMatch(/delet(e|ed|ion)/i);
  });

  it("promises the Limited Use terms: no selling, no advertising, Google API Services User Data Policy", () => {
    const html = render();
    const google = section(html, "google-user-data");
    expect(google).toMatch(/not sell/i);
    expect(google).toMatch(/advertis/i);
    expect(google).toMatch(/Limited Use/);
    expect(html).toContain('href="https://developers.google.com/terms/api-services-user-data-policy"');
  });

  it("tells people how to have their data deleted, with the contact address when one is set", () => {
    vi.stubEnv("CONTACT_EMAIL", "privacy@stow.example");
    expect(render()).toContain('href="mailto:privacy@stow.example"');
    vi.stubEnv("CONTACT_EMAIL", "");
    expect(text(render())).toMatch(/To have it deleted, contact us/);
  });
});

describe("privacy policy: true to the code", () => {
  it("asks Google only for what the policy says: the email address, nothing else", () => {
    // If this fails, someone widened the Google scopes: update the policy (and check
    // whether Google now needs a review) before changing this test.
    const { url } = startGoogleSignIn({ clientId: "id", clientSecret: "secret" }, "https://stow.example/auth/google/callback");
    expect(new URL(url).searchParams.get("scope")?.split(" ").sort()).toEqual(["email", "openid"]);
    const google = section(render(), "google-user-data");
    expect(google).toMatch(/email address only/i);
    expect(google).toMatch(/not your name, photo/i);
  });
});
