import { expect, test } from "@playwright/test";

test.describe("unauthenticated", () => {
  test("root redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("login-microsoft")).toBeVisible();
  });

  test("protected pages redirect to login and keep the target", async ({ page }) => {
    await page.goto("/groups");
    await expect(page).toHaveURL(/\/login\?next=%2Fgroups$/);
  });

  test("login page is in French by default and dark", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("heading", { name: "Ton QG d'étudiant Epitech" })).toBeVisible();
    await expect(page.getByText("Compte @epitech.eu obligatoire")).toBeVisible();
  });

  test("locale switcher toggles to English and persists", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("locale-switcher").click();
    await expect(page.getByRole("heading", { name: "Your Epitech HQ" })).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("English is picked from Accept-Language", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US", extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" } });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByTestId("login-microsoft")).toHaveText(/Continue with Microsoft/);
    await context.close();
  });

  test("shows the domain error for non-Epitech accounts", async ({ page }) => {
    await page.goto("/login?error=domain");
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("@epitech.eu");
  });

  test("Microsoft button starts the Azure OAuth flow with a safe redirect", async ({ page }) => {
    await page.goto("/login?next=//evil.example.com");
    const authorize = page.waitForRequest((req) => req.url().includes("/auth/v1/authorize"));
    // don't actually leave for Microsoft
    await page.route("**/auth/v1/authorize**", (route) => route.fulfill({ status: 200, body: "stub" }));
    await page.getByTestId("login-microsoft").click();

    const url = new URL((await authorize).url());
    expect(url.searchParams.get("provider")).toBe("azure");
    expect(url.searchParams.get("domain_hint")).toBe("epitech.eu");
    const redirectTo = new URL(url.searchParams.get("redirect_to")!);
    expect(redirectTo.pathname).toBe("/auth/callback");
    expect(redirectTo.searchParams.get("next")).toBe("/dashboard");
  });

  test("OAuth callback without a code goes back to login with an error", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=oauth$/);
  });
});
