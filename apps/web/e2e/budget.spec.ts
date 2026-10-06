import { expect, test } from "@playwright/test";

test("tracks a month and keeps it after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".box-logo")).toHaveText("epistudent");

  // monthly income + rent via quick buttons
  await page.getByRole("button", { name: "+ bourse crous" }).click();
  await page.getByLabel("Montant (€)").fill("600");
  await page.getByRole("button", { name: "ajouter", exact: true }).click();
  await page.getByRole("button", { name: "+ loyer" }).click();
  await page.getByLabel("Montant (€)").fill("400");
  await page.getByRole("button", { name: "ajouter", exact: true }).click();
  // one-off expense with a comma
  await page.getByLabel("Nom").fill("Kebab");
  await page.getByLabel("Montant (€)").fill("8,50");
  await page.getByRole("button", { name: "ajouter", exact: true }).click();

  await expect(page.getByTestId("income")).toContainText("600,00");
  await expect(page.getByTestId("expenses")).toContainText("408,50");
  await expect(page.getByTestId("balance")).toContainText("191,50");
  await expect(page.getByTestId("categories")).toContainText("loyer");

  await page.reload();
  await expect(page.getByTestId("balance")).toContainText("191,50");

  // next month: recurring lines carry over, the kebab does not
  await page.getByRole("button", { name: "mois suivant" }).click();
  await expect(page.getByTestId("balance")).toContainText("200,00");
  await expect(page.getByTestId("entries")).not.toContainText("Kebab");
});

test("rejects bad amounts and warns when in the red", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nom").fill("PC");
  await page.getByLabel("Montant (€)").fill("abc");
  await page.getByRole("button", { name: "ajouter", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Montant invalide.");
  await page.getByLabel("Montant (€)").fill("900");
  await page.getByRole("button", { name: "ajouter", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("dans le rouge");
});
