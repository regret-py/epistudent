import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminClient, createUser, hasSupabase, signIn } from "./helpers";

test.describe("auth", () => {
  test.skip(!hasSupabase, "requires a local Supabase stack (see README › Tests)");

  test("rejects sign-ups outside @epitech.eu at the database level", async () => {
    const { error } = await adminClient().auth.admin.createUser({
      email: `intruder-${randomUUID()}@gmail.com`,
      password: "e2e-password-123",
      email_confirm: true,
    });
    expect(error).not.toBeNull();
  });

  test("first login goes through onboarding, then lands on the dashboard", async ({ page, context }) => {
    const user = await createUser({ onboarded: false });
    await signIn(context, user);

    await page.goto("/dashboard/");
    await expect(page).toHaveURL(/\/onboarding\/\?next=%2Fdashboard%2F$/);

    await page.getByLabel("Promo", { exact: true }).selectOption("tek2");
    await page.getByLabel("Campus", { exact: true }).selectOption("lyon");
    await page.getByRole("button", { name: "c'est parti" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Note au moins un langage.");

    await page.getByRole("radio", { name: "C 4/5" }).click();
    await page.getByRole("radio", { name: "Python 2/5" }).click();
    await page.getByRole("button", { name: "soir" }).click();
    await page.getByRole("button", { name: "c'est parti" }).click();

    await expect(page).toHaveURL(/\/dashboard\/$/);
    await expect(page.getByTestId("dashboard-greeting")).toHaveText("salut ada.");
    await expect(page.getByText("tek 2 / Lyon")).toBeVisible();

    await page.goto("/onboarding/");
    await expect(page).toHaveURL(/\/dashboard\/$/);
  });

  test("sign out returns to login", async ({ page, context }) => {
    const user = await createUser();
    await signIn(context, user);
    await page.goto("/dashboard/");
    await expect(page.getByTestId("dashboard-greeting")).toBeVisible();
    await page.getByRole("button", { name: "déconnexion" }).first().click();
    await expect(page).toHaveURL(/\/login\//);
  });
});
