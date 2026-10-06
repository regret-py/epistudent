import { expect, test } from "./fixtures";

test("ships a strict Content-Security-Policy", async ({ guarded: page }) => {
  await page.goto("/");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("default-src 'none'");
  expect(csp).toMatch(/script-src 'self'( 'sha256-[A-Za-z0-9+/=]+')+;/);
  expect(csp).toContain("style-src 'self';");
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).toContain("form-action 'none'");
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});

test("blocks injected inline scripts", async ({ page }) => {
  await page.goto("/");
  const ran = await page.evaluate(async () => {
    const s = document.createElement("script");
    s.textContent = "window.__pwned = true";
    document.body.appendChild(s);
    await new Promise((r) => setTimeout(r, 50));
    return (window as unknown as { __pwned?: boolean }).__pwned === true;
  });
  expect(ran).toBe(false);
});

test("hostile localStorage content is neutralised", async ({ guarded: page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "epistudent-plan",
      JSON.stringify({ budget: "<img src=x onerror=alert(1)>".repeat(20), savings: 5, rent: null, shares: JSON.parse('{"__proto__":{"polluted":1},"bouffe":1e9,"sorties":-4}') }),
    );
  });
  await page.goto("/");
  await expect(page.getByLabel("budget du mois")).toHaveValue("<img src=x onerror=a");
  expect(await page.locator("img[src=x]").count()).toBe(0);
  expect(await page.evaluate(() => ({}) as Record<string, unknown>).then((o) => o.polluted)).toBeUndefined();

  await page.getByLabel("budget du mois").fill("1000");
  await page.getByRole("button", { name: "changer la répartition" }).click();
  await expect(page.getByLabel("part bouffe en pourcentage")).toHaveValue("100");
  await expect(page.getByLabel("part sorties en pourcentage")).toHaveValue("0");
});

test("corrupted storage doesn't break the page", async ({ guarded: page }) => {
  await page.addInitScript(() => localStorage.setItem("epistudent-plan", "{not json"));
  await page.goto("/");
  await page.getByLabel("budget du mois").fill("500");
  await expect(page.getByTestId("spendable")).toHaveText(/^500\s€$/);
});

test("refuses to run inside a frame (clickjacking)", async ({ page, baseURL }) => {
  // an attacker's page on another origin embedding the site
  await page.setContent(`<iframe src="${baseURL}/" width="800" height="600"></iframe>`);
  const frame = page.frameLocator("iframe");
  await expect(frame.getByRole("alert").filter({ hasText: /\S/ })).toContainText("ne s'affiche pas dans un autre site");
  await expect(frame.getByLabel("budget du mois")).toHaveCount(0);
});

test("404 page", async ({ page }) => {
  const res = await page.goto("/nope/");
  expect(res?.status()).toBe(404);
  await expect(page.locator(".box-logo")).toHaveText("404");
});
