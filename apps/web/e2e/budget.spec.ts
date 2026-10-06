import { addLine, expect, test } from "./fixtures";

test.beforeEach(async ({ guarded: page }) => {
  await page.goto("/");
  await expect(page.locator(".box-logo").first()).toHaveText("epistudent");
});

test("tracks a month, persists, carries monthly lines over", async ({ guarded: page }) => {
  await addLine(page, { quick: "bourse crous", amount: "600" });
  await addLine(page, { quick: "loyer", amount: "400" });
  await addLine(page, { label: "Kebab", amount: "8,50" });

  await expect(page.getByTestId("income")).toContainText("600,00");
  await expect(page.getByTestId("expenses")).toContainText("408,50");
  await expect(page.getByTestId("balance")).toContainText("191,50");
  await expect(page.getByTestId("categories")).toContainText("loyer");

  await page.reload();
  await expect(page.getByTestId("balance")).toContainText("191,50");

  await page.getByRole("button", { name: "mois suivant" }).click();
  await expect(page.getByTestId("balance")).toContainText("200,00");
  await expect(page.getByTestId("entries")).not.toContainText("Kebab");
  await expect(page.getByTestId("per-day")).not.toHaveText("—");

  await page.getByRole("button", { name: "aujourd'hui" }).click();
  await expect(page.getByTestId("balance")).toContainText("191,50");
});

test("edit a line, delete with undo", async ({ guarded: page }) => {
  await addLine(page, { label: "Kebab", amount: "8,50" });
  await page.getByRole("button", { name: "modifier Kebab" }).click();
  await page.getByLabel("Montant (€)").fill("12");
  await page.getByRole("button", { name: "enregistrer" }).click();
  await expect(page.getByTestId("expenses")).toContainText("12,00");

  await page.getByRole("button", { name: "supprimer Kebab" }).click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("expenses")).toContainText("0,00");
  await page.getByRole("status").getByRole("button", { name: "annuler" }).click();
  await expect(page.getByTestId("expenses")).toContainText("12,00");
});

test("stopping a monthly line keeps past months intact", async ({ guarded: page }) => {
  await addLine(page, { quick: "loyer", amount: "400" });
  await page.getByRole("button", { name: "mois suivant" }).click();
  await page.getByRole("button", { name: "supprimer Loyer" }).click();
  await expect(page.getByTestId("confirm")).toHaveText("à partir de ce mois");
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("expenses")).toContainText("0,00");
  await page.getByRole("button", { name: "mois précédent" }).click();
  await expect(page.getByTestId("expenses")).toContainText("400,00");
  await expect(page.getByTestId("entries")).toContainText("jusqu'en");
});

test("savings goal and category caps", async ({ guarded: page }) => {
  await addLine(page, { quick: "bourse crous", amount: "300" });
  await addLine(page, { quick: "courses", amount: "60" });

  await page.getByLabel("épargne visée chaque mois (€)").fill("100");
  await page.getByLabel("épargne visée chaque mois (€)").press("Enter");
  await expect(page.getByTestId("goal-status")).toContainText("Objectif tenu");

  await page.getByRole("button", { name: "fixer des plafonds par catégorie" }).click();
  await page.getByLabel("plafond courses").fill("50");
  await page.getByLabel("plafond courses").press("Enter");
  await expect(page.getByTestId("over-courses")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Plafond dépassé" })).toContainText("courses");

  await page.reload();
  await expect(page.getByTestId("over-courses")).toBeVisible();
  await expect(page.getByTestId("goal-status")).toContainText("Objectif tenu");
});

test("validation and overdraft warning", async ({ guarded: page }) => {
  await addLine(page, { label: "PC", amount: "abc" });
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Montant invalide");
  await addLine(page, { label: "PC", amount: "900" });
  await expect(page.getByRole("status").filter({ hasText: "Dans le rouge" })).toContainText("900,00");
  await expect(page.getByText("à découvert")).toBeVisible();
});

test("history and keyboard navigate months", async ({ guarded: page }) => {
  const title = page.getByTestId("month");
  const now = await title.textContent();
  await page.locator("body").press("ArrowLeft");
  await expect(title).not.toHaveText(now!);
  await page.locator("body").press("ArrowRight");
  await expect(title).toHaveText(now!);
  await page.getByTestId("history").getByRole("button").first().click();
  await expect(title).not.toHaveText(now!);
});

test("dark theme", async ({ guarded: page }) => {
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
