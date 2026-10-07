import { expect, test } from "./fixtures";

test.beforeEach(async ({ guarded: page }) => {
  await page.goto("/");
  await page.getByLabel("budget du mois").fill("1000");
});

test("profiles change the split and are highlighted", async ({ guarded: page }) => {
  const group = page.getByRole("group", { name: "ta situation" });
  await expect(group.getByRole("button", { name: "équilibré" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "budget serré" }).click();
  await expect(page.getByTestId("month-bouffe")).toHaveText(/^550\s€$/);
  await expect(group.getByRole("button", { name: "budget serré" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "chez les parents" }).click();
  await expect(page.getByTestId("month-sorties")).toHaveText(/^250\s€$/);
  await group.getByRole("button", { name: "équilibré" }).click();
  await expect(page.getByTestId("month-bouffe")).toHaveText(/^400\s€$/);
});

test("track spending per category and see what's left", async ({ guarded: page }) => {
  await page.getByTestId("toggle-tracking").click();
  await page.getByLabel("dépense en bouffe", { exact: true }).fill("45,50");
  await page.getByRole("button", { name: "ajouter la dépense en bouffe" }).click();
  await page.getByLabel("dépense en bouffe", { exact: true }).fill("4,50");
  await page.getByLabel("dépense en bouffe", { exact: true }).press("Enter");
  await expect(page.getByTestId("left-bouffe")).toHaveText(/reste 350\s€/);
  await expect(page.getByTestId("spent-total")).toHaveText(/^50\s€$/);
  await expect(page.getByTestId("left-total")).toHaveText(/^950\s€$/);

  await page.getByLabel("dépense en sorties", { exact: true }).fill("200");
  await page.getByLabel("dépense en sorties", { exact: true }).press("Enter");
  await expect(page.getByTestId("left-sorties")).toHaveText(/dépassé de 50\s€/);

  await page.getByLabel("dépense en transport", { exact: true }).fill("abc");
  await page.getByLabel("dépense en transport", { exact: true }).press("Enter");
  await expect(page.getByTestId("spending-transport")).toContainText("montant invalide");

  // remembered, and the tracker stays open when there's something tracked
  await page.reload();
  await expect(page.getByTestId("spent-total")).toHaveText(/^250\s€$/);
  await page.getByRole("button", { name: "remettre les dépenses à zéro maintenant" }).click();
  await expect(page.getByTestId("spent-total")).toHaveText(/^0\s€$/);
});

test("savings goal: months and target date", async ({ guarded: page }) => {
  await expect(page.getByTestId("goal-result")).toContainText("Entre un montant");
  await page.getByLabel("pour quoi ?").fill("un ordi");
  await page.getByLabel("combien ?").fill("600");
  await expect(page.getByTestId("goal-result")).toContainText("Ajoute une épargne mensuelle");
  await page.getByLabel("épargne voulue").fill("100");
  await expect(page.getByTestId("goal-months")).toHaveText("6 mois");
  await expect(page.getByTestId("goal-result")).toContainText("un ordi");
  await page.getByLabel("épargne voulue").fill("150");
  await expect(page.getByTestId("goal-months")).toHaveText("4 mois");
});

test("meals equivalence for the food budget", async ({ guarded: page }) => {
  // 400 € / month → 92,31 € / week → 26 meals at 3,50 €
  await expect(page.getByTestId("meals")).toContainText("26 repas");
});

test("share link round-trip, without the amounts ever reaching a server", async ({ guarded: page, context, browser, baseURL, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByLabel("épargne voulue").fill("100");
  await page.getByRole("group", { name: "ta situation" }).getByRole("button", { name: "budget serré" }).click();
  await page.getByTestId("share-link").click();
  await expect(page.getByTestId("share-link")).toHaveText("lien copié ✓");
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/\/#b=1000&s=100&p=55\.12\.5\.6\.10\.2\.10$/);

  // a friend opens the link in a fresh browser
  const ctx = await browser.newContext({ baseURL });
  const friend = await ctx.newPage();
  const requests: string[] = [];
  friend.on("request", (r) => requests.push(r.url()));
  await friend.goto(url.replace(/^https?:\/\/[^/]+/, ""));
  await expect(friend.getByTestId("from-link")).toBeVisible();
  await expect(friend.getByTestId("spendable")).toHaveText(/^900\s€$/);
  await expect(friend.getByTestId("month-bouffe")).toHaveText(/^495\s€$/);
  // the fragment is cleaned from the address bar and never sent in a request
  expect(new URL(friend.url()).hash).toBe("");
  expect(requests.some((r) => r.includes("b=1000"))).toBe(false);
  await ctx.close();
});

test("tampered share links are ignored", async ({ page }) => {
  await page.goto("/#b=<script>&p=1.2");
  await expect(page.getByTestId("from-link")).toHaveCount(0);
  await expect(page.getByLabel("budget du mois")).toHaveValue("1000");
});

test("print hides the controls", async ({ guarded: page }) => {
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("copy")).toBeHidden();
  await expect(page.getByTestId("spendable")).toBeVisible();
  await expect(page.locator("#faq")).toBeHidden();
});

test("donate buttons open the Stripe payment link in a new tab", async ({ guarded: page }) => {
  for (const id of ["donate", "donate-footer"]) {
    const link = page.getByTestId(id);
    await expect(link).toHaveAttribute("href", "https://buy.stripe.com/dRm7sNajH9ux3lf9zRcMM05");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
});
