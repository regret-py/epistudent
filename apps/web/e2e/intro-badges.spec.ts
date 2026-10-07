import { expect, test } from "./fixtures";

test.describe("intro", () => {
  test("plays on demand, then lifts by itself", async ({ guarded: page }) => {
    await page.goto("/?intro=1");
    const intro = page.getByTestId("intro");
    await expect(intro).toBeVisible();
    await expect(intro.locator(".intro-logo")).toHaveText("epistudent");
    await expect(page.locator("html")).toHaveClass(/intro-on/);
    await expect(page.locator("html")).not.toHaveClass(/intro-on/, { timeout: 5000 });
    await expect(intro).toBeHidden();
    await page.getByLabel("budget du mois").fill("900");
  });

  test("can be skipped with a click or Escape", async ({ guarded: page }) => {
    await page.goto("/?intro=1");
    await page.getByTestId("intro").click();
    await expect(page.getByTestId("intro")).toBeHidden();

    await page.goto("/?intro=1");
    await expect(page.getByTestId("intro")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("intro")).toBeHidden();
  });

  test("never plays for automated browsers or a second time", async ({ guarded: page }) => {
    await page.goto("/");
    await expect(page.getByTestId("intro")).toBeHidden();
  });
});

test.describe("badges", () => {
  test("earned as you go, with a toast, kept after reload", async ({ guarded: page }) => {
    await page.goto("/");
    await expect(page.getByTestId("badges").locator("[data-earned=true]")).toHaveCount(0);

    await page.getByLabel("budget du mois").fill("1000");
    await expect(page.getByTestId("badge-toast")).toContainText("premier budget");
    await page.getByLabel("épargne voulue").fill("100");
    await expect(page.getByTestId("badge-premier-budget")).toHaveAttribute("data-earned", "true");
    await expect(page.getByTestId("badge-epargnant")).toHaveAttribute("data-earned", "true");
    await expect(page.getByTestId("badge-dix-pourcent")).toHaveAttribute("data-earned", "true");

    await page.getByRole("group", { name: "ta situation" }).getByRole("button", { name: "budget serré" }).click();
    await expect(page.getByTestId("badge-sur-mesure")).toHaveAttribute("data-earned", "true");
    await page.getByLabel("combien ?").fill("600");
    await expect(page.getByTestId("badge-objectif")).toHaveAttribute("data-earned", "true");

    await page.getByTestId("toggle-tracking").click();
    await page.getByLabel("dépense en bouffe", { exact: true }).fill("20");
    await page.getByLabel("dépense en bouffe", { exact: true }).press("Enter");
    await expect(page.getByTestId("badge-a-la-trace")).toHaveAttribute("data-earned", "true");

    await expect(page.locator("#badges-title")).toContainText("6 / 12");
    await page.reload();
    await expect(page.getByTestId("badges").locator("[data-earned=true]")).toHaveCount(6);
    await expect(page.getByTestId("badge-epargnant")).toContainText(/débloqué.*le \d/);
  });

  test("locked badges explain how to get them", async ({ guarded: page }) => {
    await page.goto("/");
    await expect(page.getByTestId("badge-fidele")).toContainText("revenir 7 jours différents");
    await expect(page.getByTestId("badge-fidele")).toHaveAttribute("data-earned", "false");
  });

  test("visits on different days unlock habitué", async ({ guarded: page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem("epistudent-plan"))
        localStorage.setItem("epistudent-plan", JSON.stringify({ visits: ["2026-01-01", "2026-01-02"] }));
    });
    await page.goto("/");
    await expect(page.getByTestId("badge-habitue")).toHaveAttribute("data-earned", "true");
  });
});
