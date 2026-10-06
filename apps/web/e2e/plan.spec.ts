import { expect, test } from "./fixtures";

test.beforeEach(async ({ guarded: page }) => {
  await page.goto("/");
  await expect(page.locator(".box-logo").first()).toHaveText("epistudent");
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
  await expect(page.getByTestId("savings")).toContainText("100");
  await expect(page.locator("[data-testid^=line-]")).toHaveCount(7);
  await expect(page.getByTestId("total")).toContainText("400");
});

test("remembers the amounts after a reload", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("1 200,50");
  await page.getByLabel("épargne voulue").fill("200,50");
  await expect(page.getByTestId("spendable")).toHaveText(/^1\s000\s€$/);
  await page.reload();
  await expect(page.getByLabel("budget du mois")).toHaveValue("1 200,50");
  await expect(page.getByTestId("spendable")).toHaveText(/^1\s000\s€$/);
});

test("explains impossible and invalid amounts", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("500");
  await page.getByLabel("épargne voulue").fill("200");
  await page.getByLabel("loyer & fixes").fill("400");
  await expect(page.getByTestId("too-much")).toContainText("100");

  await page.getByLabel("épargne voulue").fill("abc");
  await expect(page.getByRole("alert").filter({ hasText: "Montant invalide" })).toBeVisible();
});

test("custom split, then back to the default", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("1000");
  await page.getByRole("button", { name: "changer la répartition" }).click();
  await page.getByLabel("part bouffe en pourcentage").fill("50");
  await expect(page.getByTestId("line-bouffe")).toContainText("45,45 %");
  await page.getByRole("button", { name: "plus de sorties" }).click();
  await expect(page.getByLabel("part sorties en pourcentage")).toHaveValue("16");

  await page.reload();
  await page.getByRole("button", { name: "changer la répartition" }).click();
  await expect(page.getByLabel("part bouffe en pourcentage")).toHaveValue("50");
  await page.getByRole("button", { name: "revenir à la répartition conseillée" }).click();
  await expect(page.getByTestId("month-bouffe")).toHaveText(/^400\s€$/);
});

test("copy to clipboard", async ({ guarded: page, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByLabel("budget du mois").fill("800");
  await page.getByTestId("copy").click();
  await expect(page.getByTestId("copy")).toHaveText("copié ✓");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("bouffe : 320");
  expect(text).toContain("epistudent.fr");
});

test("reset and dark theme", async ({ guarded: page }) => {
  await page.getByLabel("budget du mois").fill("800");
  await page.getByRole("button", { name: "tout effacer" }).click();
  await expect(page.getByLabel("budget du mois")).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("budget du mois")).toHaveValue("");
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
