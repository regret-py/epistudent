import { expect, test } from "@playwright/test";

test.describe("unauthenticated", () => {
  test("root redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\/$/);
    await expect(page.getByTestId("login-microsoft")).toBeVisible();
  });

  test("protected pages redirect to login and keep the target", async ({ page }) => {
    await page.goto("/groups/");
    await expect(page).toHaveURL(/\/login\/\?next=%2Fgroups%2F$/);
  });

  test("login page is in French, light, with the box logo", async ({ page }) => {
    await page.goto("/login/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.locator(".box-logo").first()).toHaveText("epistudent");
    await expect(page.getByRole("heading", { name: "le hub des étudiants epitech." })).toBeVisible();
  });

  test("language switch persists", async ({ page }) => {
    await page.goto("/login/");
    await page.getByTestId("locale-switcher").click();
    await expect(page.getByRole("heading", { name: "the epitech student hub." })).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("English browsers get English", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/login/");
    await expect(page.getByTestId("login-microsoft")).toHaveText(/sign in with microsoft/i);
    await context.close();
  });

  test("dark theme toggle", async ({ page }) => {
    await page.goto("/login/");
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("shows the domain error for non-Epitech accounts", async ({ page }) => {
    await page.goto("/login/?error=domain");
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("@epitech.eu");
  });

  test("Microsoft button starts the Azure PKCE flow with a safe redirect", async ({ page }) => {
    await page.goto("/login/?next=//evil.example.com");
    const authorize = page.waitForRequest((req) => req.url().includes("/auth/v1/authorize"));
    await page.route("**/auth/v1/authorize**", (route) => route.fulfill({ status: 200, body: "stub" }));
    await page.getByTestId("login-microsoft").click();

    const url = new URL((await authorize).url());
    expect(url.searchParams.get("provider")).toBe("azure");
    expect(url.searchParams.get("domain_hint")).toBe("epitech.eu");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
    const redirectTo = new URL(url.searchParams.get("redirect_to")!);
    expect(redirectTo.pathname).toBe("/auth/callback/");
    expect(redirectTo.searchParams.get("next")).toBe("/dashboard/");
  });

  test("OAuth callback without a session goes back to login with an error", async ({ page }) => {
    await page.goto("/auth/callback/");
    await expect(page).toHaveURL(/\/login\/\?error=oauth$/);
  });

  test("unknown pages render the 404", async ({ page }) => {
    const res = await page.goto("/nope/");
    expect(res?.status()).toBe(404);
    await expect(page.locator(".box-logo")).toHaveText("404");
  });
});
