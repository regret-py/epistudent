import { expect, test } from "./fixtures";

const shareInput = (label: string) => `part « ${label} » en pourcentage`;

test.beforeEach(async ({ guarded: page }) => {
  await page.goto("/");
  await expect(page.locator("header .box-logo")).toHaveText("epistudent");
});

test("budget + savings + rent give a split per category", async ({ guarded: page }) => {
  await expect(page.getByText("Entre ton budget du mois")).toBeVisible();
  await page.getByLabel("budget du mois").fill("900");
  await page.getByLabel("épargne voulue").fill("100");
  await page.getByLabel("loyer & fixes").fill("400");

  await expect(page.getByTestId("spendable")).toHaveText(/^400\s€$/);
  await expect(page.getByTestId("month-bouffe")).toHaveText(/^160\s€$/);
  await expect(page.getByTestId("month-sorties")).toHaveText(/^60\s€$/);
  await expect(page.getByTestId("week-bouffe")).toHaveText(/^36,92\s€$/);
  await expect(page.getByTestId("savings")).toHaveText(/^100\s€$/);
  await expect(page.locator("[data-testid^=line-]")).toHaveCount(7);
  await expect(page.getByTestId("total")).toContainText("400");
  await expect(page.getByTestId("line-bouffe")).toContainText("40 %");
  await expect(page.getByText("une fois l'épargne et les fixes mis de côté")).toBeVisible();
});

test("remembers the amounts after a reload; two decimals or none", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("1 200,50");
  await page.getByLabel("épargne voulue").fill("200");
  await expect(page.getByTestId("spendable")).toHaveText(/^1\s000,50\s€$/);
  await page.reload();
  await expect(page.getByLabel("budget du mois")).toHaveValue("1 200,50");
  await expect(page.getByTestId("spendable")).toHaveText(/^1\s000,50\s€$/);
});

test("accepts French ways of writing amounts, including mid-typing", async ({ guarded: page }) => {
  const budget = page.getByLabel("budget du mois");
  await budget.fill("1.200");
  await expect(page.getByTestId("spendable")).toHaveText(/^1\s200\s€$/);
  await budget.fill("900,");
  await expect(page.getByTestId("spendable")).toHaveText(/^900\s€$/);
  await expect(page.getByText("Montant invalide")).toHaveCount(0);
});

test("a wrong amount blocks the result instead of counting as 0", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("900");
  await page.getByLabel("épargne voulue").fill("abc");
  await expect(page.getByTestId("invalid")).toContainText("épargne voulue");
  await expect(page.getByTestId("spendable")).toHaveCount(0);
  await expect(page.getByTestId("copy")).toHaveCount(0);
  // the field message appears once you leave the field
  await page.getByLabel("loyer & fixes").focus();
  await expect(page.getByText("Montant invalide (ex. 850 ou 1 200,50).")).toBeVisible();
  await page.getByLabel("épargne voulue").fill("5000000");
  await page.getByLabel("loyer & fixes").focus();
  await expect(page.getByText("Maximum 1 000 000 €.")).toBeVisible();
});

test("too much, and exactly nothing left", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("500");
  await page.getByLabel("épargne voulue").fill("200");
  await page.getByLabel("loyer & fixes").fill("400");
  await expect(page.getByTestId("too-much")).toContainText("100 €");

  await page.getByLabel("épargne voulue").fill("100");
  await expect(page.getByTestId("nothing-left")).toContainText("Il ne te reste rien");
  await expect(page.getByText("-0")).toHaveCount(0);
});

test("custom split with decimals, then back to the default", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("1000");
  await page.getByRole("button", { name: "changer la répartition" }).click();
  await page.getByLabel(shareInput("bouffe")).fill("50");
  await expect(page.getByTestId("line-bouffe")).toContainText("45,45 %");
  await page.getByRole("button", { name: "augmenter la part « sorties »" }).click();
  await expect(page.getByLabel(shareInput("sorties"))).toHaveValue("16");

  // decimals are rounded, never glued together ("7.5" must not become 75)
  const transport = page.getByLabel(shareInput("transport"));
  await transport.fill("");
  await transport.pressSequentially("7.5");
  await transport.blur();
  await expect(transport).toHaveValue("8");

  await page.reload();
  await page.getByRole("button", { name: "changer la répartition" }).click();
  await expect(page.getByLabel(shareInput("bouffe"))).toHaveValue("50");
  await page.getByRole("button", { name: "revenir à la répartition conseillée" }).click();
  await expect(page.getByTestId("month-bouffe")).toHaveText(/^400\s€$/);
});

test("setting every share to 0 never locks the user out", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("900");
  await page.getByRole("button", { name: "changer la répartition" }).click();
  for (const label of ["transport", "sorties", "abonnements", "hygiène & santé", "shopping", "imprévus"]) {
    await page.getByLabel(shareInput(label)).fill("0");
  }
  // clearing a field and leaving it keeps the previous value (no accidental 0)
  const food = page.getByLabel(shareInput("bouffe"));
  await food.fill("");
  await food.blur();
  await expect(food).toHaveValue("40");
  await food.fill("0");
  await expect(page.getByTestId("no-share")).toBeVisible();
  // the editor stays on screen so the user can fix it right away
  await expect(page.getByTestId("shares")).toBeVisible();
  await expect(food).toBeFocused();

  await page.reload();
  // a saved all-zero split falls back to the default one
  await expect(page.getByTestId("month-bouffe")).toHaveText(/^360\s€$/);

  await page.getByRole("button", { name: "changer la répartition" }).click();
  for (const label of ["bouffe", "transport", "sorties", "abonnements", "hygiène & santé", "shopping", "imprévus"]) {
    await page.getByLabel(shareInput(label)).fill("0");
  }
  await page.getByTestId("no-share").getByRole("button", { name: "revenir à la répartition conseillée" }).click();
  await expect(page.getByTestId("month-bouffe")).toHaveText(/^360\s€$/);
});

test("copy to clipboard", async ({ guarded: page, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByLabel("budget du mois").fill("800");
  await page.getByTestId("copy").click();
  await expect(page.getByTestId("copy")).toHaveText("copié ✓");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/bouffe : 320\s€\/mois/);
  expect(text).toContain("epistudent.fr");
});

test("reset asks for confirmation and gives focus back", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("800");
  await page.getByTestId("reset").click();
  await expect(page.getByTestId("reset")).toHaveText("sûr ? tout effacer");
  await expect(page.getByLabel("budget du mois")).toHaveValue("800");
  await page.getByTestId("reset").click();
  await expect(page.getByLabel("budget du mois")).toHaveValue("");
  await expect(page.getByLabel("budget du mois")).toBeFocused();
  await page.reload();
  await expect(page.getByLabel("budget du mois")).toHaveValue("");
});

test("huge amounts never overflow, on any width", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("999 999,99");
  await page.getByLabel("épargne voulue").fill("0,01");
  await expect(page.getByTestId("spendable")).toHaveText(/^999\s999,98\s€$/);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const cells = [...document.querySelectorAll<HTMLElement>("[data-testid=lines] li, .cell")].filter((c) => c.scrollWidth > c.clientWidth + 1);
      return { doc, cells: cells.length };
    });
    expect(overflow, `width ${width}`).toEqual({ doc: false, cells: 0 });
  }
});

test("dark theme also recolours the browser bar", async ({ guarded: page }) => {
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#000000");
});

test("one short screen-reader announcement, no live region over the result", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("900");
  await expect(page.getByRole("status")).toHaveText(/À dépenser : 900\s€ par mois\. Bouffe : 360\s€/);
  expect(await page.locator("main [aria-live]").count()).toBe(0);
});

test("SEO basics are in the static HTML", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain('<link rel="canonical" href="https://epistudent.fr/"');
  expect(html).toContain('content="epistudent — calculateur de budget étudiant : combien pour la bouffe ?"/>');
  expect(html).toMatch(/<meta property="og:image" content="https:\/\/epistudent\.fr\/opengraph-image\.png/);
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain("Comment est calculé mon budget bouffe ?");
  expect((html.match(/<h1/g) ?? []).length).toBe(1);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://epistudent.fr/sitemap.xml");
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  expect((await request.get("/favicon.ico")).status()).toBe(200);
});
