import { readFileSync } from "node:fs";
import { addLine, expect, test } from "./fixtures";

const STORAGE_KEY = "epistudent-budget";

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

test("labels are rendered as text, never as HTML", async ({ guarded: page }) => {
  await page.goto("/");
  const payload = '<img src=x onerror="window.__pwned=1">';
  await addLine(page, { label: payload, amount: "5" });
  await expect(page.getByTestId("entries")).toContainText(payload);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await page.locator("img[src=x]").count()).toBe(0);
});

test("encryption: nothing readable at rest, lock screen, wrong code, auto-lock link", async ({ guarded: page }) => {
  await page.goto("/");
  await addLine(page, { label: "Loyer secret", amount: "420" });

  await page.getByRole("button", { name: "protéger par un code" }).click();
  await page.getByLabel("Nouveau code").fill("mon chat mange des pâtes");
  await page.getByLabel("Confirme le code").fill("autre chose");
  await page.getByRole("button", { name: "chiffrer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("ne correspondent pas");
  await page.getByLabel("Confirme le code").fill("mon chat mange des pâtes");
  await page.getByRole("button", { name: "chiffrer" }).click();
  await expect(page.getByTestId("lock-status")).toHaveText(/chiffré/);

  const stored = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  expect(stored).not.toContain("Loyer");
  expect(JSON.parse(stored!)).toMatchObject({ format: "epistudent-vault", kdf: "PBKDF2-SHA256", iterations: 600000 });

  // edits after locking are encrypted too
  await addLine(page, { label: "Abonnement caché", amount: "9" });
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).not.toContain("caché");

  await page.reload();
  await expect(page.getByRole("heading", { name: "verrouillé." })).toBeVisible();
  await expect(page.getByText("Loyer secret")).toHaveCount(0);

  await page.getByLabel("Code").fill("mauvais code");
  await page.getByRole("button", { name: "ouvrir" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Code incorrect.");

  await page.getByLabel("Code").fill("mon chat mange des pâtes");
  await page.getByRole("button", { name: "ouvrir" }).click();
  await expect(page.getByTestId("entries")).toContainText("Loyer secret");
  await expect(page.getByTestId("entries")).toContainText("Abonnement caché");

  await page.getByTestId("lock-now").click();
  await expect(page.getByRole("heading", { name: "verrouillé." })).toBeVisible();
});

test("repeated wrong codes slow down", async ({ guarded: page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "protéger par un code" }).click();
  await page.getByLabel("Nouveau code").fill("bonne phrase secrete");
  await page.getByLabel("Confirme le code").fill("bonne phrase secrete");
  await page.getByRole("button", { name: "chiffrer" }).click();
  await expect(page.getByTestId("lock-status")).toHaveText(/chiffré/);
  await page.getByTestId("lock-now").click();
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("Code").fill(`faux ${i}`);
    await page.getByRole("button", { name: "ouvrir" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Code incorrect.");
  }
  await expect(page.getByRole("status").filter({ hasText: "Trop d'essais" })).toBeVisible();
  await expect(page.getByLabel("Code")).toBeDisabled();
});

test("export then import into a fresh browser (plain and encrypted)", async ({ guarded: page, browser, baseURL }) => {
  await page.goto("/");
  await addLine(page, { label: "Bourse", amount: "500", kind: "revenu" });

  const plainDl = page.waitForEvent("download");
  await page.getByRole("button", { name: "exporter" }).click();
  const plainPath = await (await plainDl).path();
  expect(readFileSync(plainPath, "utf8")).toContain("Bourse");

  await page.getByRole("button", { name: "protéger par un code" }).click();
  await page.getByLabel("Nouveau code").fill("export chiffré 2026");
  await page.getByLabel("Confirme le code").fill("export chiffré 2026");
  await page.getByRole("button", { name: "chiffrer" }).click();
  await expect(page.getByTestId("lock-status")).toHaveText(/chiffré/);
  const encDl = page.waitForEvent("download");
  await page.getByRole("button", { name: "exporter" }).click();
  const encPath = await (await encDl).path();
  expect(readFileSync(encPath, "utf8")).not.toContain("Bourse");

  const ctx = await browser.newContext({ baseURL });
  const fresh = await ctx.newPage();
  await fresh.goto("/");
  await fresh.getByTestId("import-input").setInputFiles({ name: "b.json", mimeType: "application/json", buffer: readFileSync(encPath) });
  await fresh.getByLabel("Code de ce fichier chiffré").fill("pas le bon");
  await fresh.getByRole("button", { name: "déchiffrer" }).click();
  await expect(fresh.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Code incorrect");
  await fresh.getByLabel("Code de ce fichier chiffré").fill("export chiffré 2026");
  await fresh.getByRole("button", { name: "déchiffrer" }).click();
  await fresh.getByTestId("confirm").click();
  await expect(fresh.getByTestId("income")).toContainText("500,00");

  await fresh.getByTestId("import-input").setInputFiles({ name: "p.json", mimeType: "application/json", buffer: readFileSync(plainPath) });
  await fresh.getByTestId("confirm").click();
  await expect(fresh.getByTestId("entries")).toContainText("Bourse");
  await ctx.close();
});

test("hostile import files are neutralised", async ({ guarded: page }) => {
  await page.goto("/");
  const hostile = JSON.stringify({
    __proto__: { polluted: true },
    entries: [
      { id: "ok", kind: "expense", label: "Normal", amount: 10, category: "courses", month: "2026-10", recurring: false },
      { id: "x", kind: "expense", label: "<script>alert(1)</script>", amount: 1, category: "../../etc", month: "2026-10", recurring: false },
      { kind: "expense", label: "Inf", amount: 1e308 * 10, month: "2026-10" },
      { kind: "steal", label: "bad kind", amount: 1, month: "2026-10" },
    ],
    limits: { constructor: 1, courses: "50" },
    goal: -5,
  });
  await page.getByTestId("import-input").setInputFiles({ name: "evil.json", mimeType: "application/json", buffer: Buffer.from(hostile) });
  await expect(page.getByRole("dialog")).toContainText("(2 lignes)");
  await page.getByTestId("confirm").click();
  expect(await page.evaluate(() => ({}) as Record<string, unknown>).then((o) => o.polluted)).toBeUndefined();

  await page.getByTestId("import-input").setInputFiles({ name: "junk.json", mimeType: "application/json", buffer: Buffer.from("not json") });
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Fichier illisible");
});

test("wipe needs an explicit confirmation", async ({ guarded: page }) => {
  await page.goto("/");
  await addLine(page, { label: "À garder", amount: "3" });
  await page.getByRole("button", { name: "tout effacer" }).click();
  await expect(page.getByTestId("confirm")).toBeDisabled();
  await page.getByLabel('Tape "effacer" pour confirmer').fill("effacer");
  await page.getByTestId("confirm").click();
  await expect(page.getByText("À garder")).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
});

test("refuses to run inside a frame (clickjacking)", async ({ page, baseURL }) => {
  // an attacker's page on another origin embedding the site
  await page.setContent(`<iframe src="${baseURL}/" width="800" height="600"></iframe>`);
  const frame = page.frameLocator("iframe");
  await expect(frame.getByRole("alert").filter({ hasText: /\S/ })).toContainText("ne s'affiche pas dans un autre site");
  await expect(frame.getByLabel("Montant (€)")).toHaveCount(0);
});

test("404 page", async ({ page }) => {
  const res = await page.goto("/nope/");
  expect(res?.status()).toBe(404);
  await expect(page.locator(".box-logo")).toHaveText("404");
});
