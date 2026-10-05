import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminClient, createTestUser, hasSupabase, signInContext } from "./supabase-session";

test.describe("authenticated flows", () => {
  test.skip(!hasSupabase, "requires a local Supabase stack (see README › Tests)");

  test("rejects sign-ups outside @epitech.eu at the database level", async () => {
    const { error } = await adminClient().auth.admin.createUser({
      email: `intruder-${randomUUID()}@gmail.com`,
      password: "e2e-password-123",
      email_confirm: true,
    });
    expect(error).not.toBeNull();
  });

  test("first login goes through onboarding, then lands on the dashboard", async ({ page, context, baseURL }) => {
    const email = `e2e-${randomUUID()}@epitech.eu`;
    const { password } = await createTestUser(email);
    await signInContext(context, baseURL!, email, password);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByLabel("Promo", { exact: true }).selectOption("tek2");
    await page.getByLabel("Campus", { exact: true }).selectOption("lyon");

    // submitting without languages is refused client-side by the server action validation
    await page.getByRole("button", { name: "C'est parti" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Note au moins un langage.");

    await page.getByRole("radio", { name: "C 4/5" }).click();
    await page.getByRole("radio", { name: "Python 2/5" }).click();
    await page.getByRole("button", { name: "Le soir" }).click();
    await page.getByRole("button", { name: "C'est parti" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("dashboard-greeting")).toContainText("Salut Ada");
    await expect(page.getByText("Tek2")).toBeVisible();
    await expect(page.getByText("Lyon")).toBeVisible();

    // onboarding is one-shot
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("signing out returns to the login page", async ({ page, context, baseURL }) => {
    const email = `e2e-${randomUUID()}@epitech.eu`;
    const { password } = await createTestUser(email);
    await signInContext(context, baseURL!, email, password);

    await page.goto("/onboarding");
    await page.getByRole("radio", { name: "C 3/5" }).click();
    await page.getByRole("button", { name: "En semaine" }).click();
    await page.getByRole("button", { name: "C'est parti" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  });
});
