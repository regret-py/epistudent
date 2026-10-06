import { randomUUID } from "node:crypto";
import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

test("Microsoft sign-in starts a PKCE OAuth flow back to the site", async ({ guarded: page, baseURL }) => {
  await page.goto("/");
  const authorize = page.waitForRequest((r) => r.url().includes("/auth/v1/authorize"));
  await page.route("**/auth/v1/authorize**", (route) => route.fulfill({ status: 200, body: "stub" }));
  await page.getByTestId("microsoft-sign-in").click();
  const u = new URL((await authorize).url());
  expect(u.searchParams.get("provider")).toBe("azure");
  expect(u.searchParams.get("scopes")).toContain("email");
  expect(u.searchParams.get("code_challenge_method")).toBe("s256");
  expect(u.searchParams.get("redirect_to")).toBe(`${baseURL}/`);
});

test.describe("with a real Supabase", () => {
  test.skip(!serviceKey, "needs the local Supabase stack (pnpm db:start) and its keys in the env");

  const admin = () => createClient(url, serviceKey, { auth: { persistSession: false } });

  async function newUser() {
    const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Ada Lovelace" } });
    if (error) throw error;
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: s, error: e } = await anon.auth.signInWithPassword({ email, password });
    if (e) throw e;
    return { id: data.user.id, email, session: s.session as Session };
  }

  // stands in for the Microsoft redirect: put the session where supabase-js looks for it, once
  async function signIn(page: Page, session: Session) {
    if (page.url() === "about:blank") await page.goto("/");
    await page.evaluate((value) => localStorage.setItem("epistudent-auth", value), JSON.stringify(session));
    await page.reload();
  }

  test("first sign-in uploads the local budget, another device gets it, edits sync", async ({ guarded: page, browser, baseURL }) => {
    const user = await newUser();
    await page.goto("/");
    await page.getByLabel("budget du mois").fill("850");
    await page.getByLabel("épargne voulue").fill("50");

    await signIn(page, user.session);
    await expect(page.getByTestId("account-name")).toHaveText("Ada Lovelace");
    await expect(page.getByTestId("account-notice")).toContainText("sauvegardé dans ton compte");
    await expect(page.getByTestId("sync-status")).toHaveText("sauvegardé ✓");
    await expect.poll(async () => (await admin().from("budgets").select("data").eq("user_id", user.id).single()).data?.data.budget).toBe("850");

    // a second device, empty, signed in to the same account
    const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const p2 = await phone.newPage();
    await signIn(p2, user.session);
    await expect(p2.getByLabel("budget du mois")).toHaveValue("850");
    await expect(p2.getByTestId("account-notice")).toContainText("récupéré");

    await p2.getByLabel("budget du mois").fill("900");
    await expect(p2.getByTestId("sync-status")).toHaveText("sauvegardé ✓");
    await expect.poll(async () => (await admin().from("budgets").select("data").eq("user_id", user.id).single()).data?.data.budget).toBe("900");

    await page.reload();
    await expect(page.getByLabel("budget du mois")).toHaveValue("900");
    await phone.close();
  });

  // not "guarded": after deletion the logout endpoint answers 403 (user gone), which supabase-js treats as signed out
  test("sign-out clears the device; deleting the account removes everything", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const user = await newUser();
    await signIn(page, user.session);
    await page.getByLabel("budget du mois").fill("700");
    await expect.poll(async () => (await admin().from("budgets").select("data").eq("user_id", user.id).single()).data?.data.budget).toBe("700");

    await page.getByTestId("delete-account").click();
    await expect(page.getByTestId("delete-account")).toHaveText("sûr ? tout supprimer");
    await page.getByTestId("delete-account").click();
    await expect(page.getByTestId("account-notice")).toContainText("Compte et données supprimés");
    await expect(page.getByLabel("budget du mois")).toHaveValue("");
    await expect(page.getByTestId("microsoft-sign-in")).toBeVisible();
    expect((await admin().from("budgets").select("user_id").eq("user_id", user.id)).data).toEqual([]);
    expect((await admin().auth.admin.getUserById(user.id)).data.user).toBeNull();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("epistudent-auth"))).toBeNull();
  });

  test("sign-out keeps the budget in the account but not on the device", async ({ guarded: page }) => {
    const user = await newUser();
    await signIn(page, user.session);
    await expect(page.getByTestId("sync-status")).toHaveText("sauvegardé ✓");
    // sign out immediately after an edit: it must still reach the account
    await page.getByLabel("budget du mois").fill("640");
    await page.getByTestId("sign-out").click();
    await expect(page.getByLabel("budget du mois")).toHaveValue("");
    await page.reload();
    await expect(page.getByLabel("budget du mois")).toHaveValue("");
    expect((await admin().from("budgets").select("data").eq("user_id", user.id).single()).data?.data.budget).toBe("640");
  });

  test("row level security: nobody can read or overwrite someone else's budget", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const as = (s: Session) => createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } } });
    await as(alice.session).from("budgets").insert({ user_id: alice.id, data: { budget: "1" } });

    expect((await as(bob.session).from("budgets").select("*").eq("user_id", alice.id)).data).toEqual([]);
    expect((await as(bob.session).from("budgets").insert({ user_id: alice.id, data: {} })).error).not.toBeNull();
    await as(bob.session).from("budgets").update({ data: { budget: "hacked" } }).eq("user_id", alice.id);
    expect((await admin().from("budgets").select("data").eq("user_id", alice.id).single()).data?.data.budget).toBe("1");
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    expect((await anon.from("budgets").select("*")).data ?? []).toEqual([]);
    // oversized payloads are refused by the database
    expect((await as(bob.session).from("budgets").insert({ user_id: bob.id, data: { junk: "x".repeat(30000) } })).error).not.toBeNull();
  });
});
