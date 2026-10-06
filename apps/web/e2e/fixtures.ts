import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test fails if the page logs an error (CSP violations show up as console errors),
 * throws, or talks to any origin other than the site itself.
 */
export const test = base.extend<{ guarded: Page }>({
  guarded: async ({ page, baseURL }, use) => {
    const problems: string[] = [];
    const origin = new URL(baseURL!).origin;
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gayltuhbhsojbrfmjzvg.supabase.co").origin;
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    page.on("request", (req) => {
      const url = req.url();
      if (![origin, supabaseOrigin, "blob:", "data:"].some((o) => url.startsWith(o))) problems.push(`external request: ${url}`);
    });
    await use(page);
    expect(problems, problems.join("\n")).toEqual([]);
  },
});

export { expect };
