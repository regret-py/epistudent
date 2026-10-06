import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test fails if the page logs an error (CSP violations show up as console errors),
 * throws, or talks to any origin other than the site itself.
 */
export const test = base.extend<{ guarded: Page }>({
  guarded: async ({ page, baseURL }, use) => {
    const problems: string[] = [];
    const origin = new URL(baseURL!).origin;
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) problems.push(`external request: ${url}`);
    });
    await use(page);
    expect(problems, problems.join("\n")).toEqual([]);
  },
});

export { expect };

export async function addLine(page: Page, opts: { quick?: string; label?: string; amount: string; kind?: "revenu" | "dépense"; monthly?: boolean }) {
  if (opts.quick) await page.getByRole("button", { name: `+ ${opts.quick}` }).click();
  if (opts.kind) await page.getByRole("button", { name: opts.kind, exact: true }).click();
  if (opts.label) await page.getByLabel("Nom").fill(opts.label);
  await page.getByLabel("Montant (€)").fill(opts.amount);
  if (opts.monthly) await page.getByLabel(/Tous les mois/).check();
  await page.getByRole("button", { name: "ajouter", exact: true }).click();
}
