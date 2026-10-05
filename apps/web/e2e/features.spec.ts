import { randomUUID } from "node:crypto";
import { expect, test, type Browser } from "@playwright/test";
import { adminClient, createUser, hasSupabase, newSignedInPage, type TestUser } from "./helpers";

test.skip(!hasSupabase, "requires a local Supabase stack (see README › Tests)");
// multi-user scenarios: one browser context per student
test.describe.configure({ mode: "parallel" });

async function pageFor(browser: Browser, user: TestUser) {
  const context = await browser.newContext({ locale: "fr-FR" });
  return newSignedInPage(context, user);
}

test("deadlines: add a new project, see it in list and calendar, mark it done", async ({ browser }) => {
  const page = await pageFor(browser, await createUser());
  const name = `proj-${randomUUID().slice(0, 6)}`;
  await page.goto("/deadlines/");
  await page.getByLabel("Code module").fill("b-cpe-200");
  await page.getByLabel("Nom", { exact: true }).fill(name);
  const due = new Date(Date.now() + 2 * 86_400_000);
  const local = new Date(due.getTime() - due.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel("Échéance").fill(local);
  await page.getByRole("button", { name: "ajouter", exact: true }).click();

  const row = page.getByTestId("deadline-list").getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("B-CPE-200");
  await expect(row).toContainText("< 3 jours");

  await row.getByRole("combobox").selectOption("done");
  await expect(row.getByText(name)).toHaveClass(/line-through/);

  await page.getByRole("button", { name: "calendrier" }).click();
  await expect(page.getByTestId("calendar")).toContainText(name);
});

test("rooms: report earns karma, a confirmation by someone else earns more", async ({ browser }) => {
  const campus = "nantes";
  const reporter = await createUser({ profile: { city: campus } });
  const other = await createUser({ name: "Bob Builder", profile: { city: campus } });
  const room = `Salle ${randomUUID().slice(0, 4)}`;

  const a = await pageFor(browser, reporter);
  await a.goto("/rooms/");
  await a.getByLabel("Salle", { exact: true }).fill(room);
  await a.getByLabel("Places libres").fill("12");
  await a.getByRole("button", { name: "signaler (+1 karma)" }).click();
  await expect(a.getByTestId("room-list")).toContainText(room);
  await expect(a.locator("svg[role=img]")).toContainText(room);

  const b = await pageFor(browser, other);
  await b.goto("/rooms/");
  const row = b.getByTestId("room-list").getByRole("listitem").filter({ hasText: room });
  await row.getByRole("button", { name: "confirmer" }).click();
  await expect(row.getByRole("button", { name: "confirmé" })).toBeDisabled();

  await a.goto("/dashboard/");
  await expect(a.getByTestId("karma")).toHaveText("3");
});

test("moulinette: anonymous submission feeds the aggregates", async ({ browser }) => {
  const user = await createUser();
  const page = await pageFor(browser, user);
  const project = `mysh-${randomUUID().slice(0, 4)}`;
  await page.goto("/moulinette/");
  await page.getByLabel("Projet").fill(project);
  await page.getByLabel("Score (%)").fill("72");
  await page.getByLabel("Heures passées").fill("15");
  await page.getByLabel("Pièges (séparés par des virgules)").fill("signal handling, env vide");
  await page.getByRole("button", { name: "envoyer anonymement" }).click();
  await expect(page.getByText("Merci ! Ton retour est enregistré.")).toBeVisible();

  const row = page.getByTestId("moulinette-table").getByRole("row").filter({ hasText: project });
  await expect(row).toContainText("72 %");
  await expect(row).toContainText("100 %");
  await expect(page.getByTestId("pitfalls")).toContainText("signal handling");

  // nothing in the stored row points back to the user
  const { data } = await adminClient().from("moulinette_reports").select("*").eq("project_label", project).single();
  expect(Object.keys(data!)).not.toContain("user_id");
  expect(JSON.stringify(data)).not.toContain(user.id);
  expect(JSON.stringify(data)).not.toContain(user.email);
});

test("swaps: taking an offer matches both sides and shares contacts", async ({ browser }) => {
  const alice = await createUser({ name: "Alice Swap" });
  const bob = await createUser({ name: "Bob Swap" });
  // unique minutes so parallel runs never cross-match
  const base = Date.UTC(2027, 0, 10, 9, 0) + Math.floor(Math.random() * 100_000) * 60_000;
  const toLocal = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  const a = await pageFor(browser, alice);
  await a.goto("/swaps/");
  await a.getByLabel("J'ai le créneau").fill(toLocal(base));
  await a.getByLabel("Je veux le créneau").fill(toLocal(base + 3_600_000));
  await a.getByRole("button", { name: "publier" }).click();
  await expect(a.getByTestId("my-swaps")).toContainText("en attente");

  const b = await pageFor(browser, bob);
  await b.goto("/swaps/");
  // same format as the page (formatDateTime, fr), so we take Alice's offer and not another one
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(base);
  await b.getByTestId("swap-market").getByRole("listitem").filter({ hasText: label }).getByRole("button", { name: "je prends" }).click();
  await expect(b.getByTestId("swap-flash")).toHaveText("Match ! Vous avez été notifiés tous les deux.");
  await expect(b.getByTestId("my-swaps")).toContainText(alice.email);

  await a.reload();
  await expect(a.getByTestId("my-swaps")).toContainText("matché");
  await expect(a.getByTestId("my-swaps")).toContainText(bob.email);
  await expect(a.getByTestId("unread-count")).toHaveText("1");
});

test("groups: matchmaking, join, realtime chat", async ({ browser }) => {
  const project = `group-${randomUUID().slice(0, 6)}`;
  const { data: proj } = await adminClient().from("projects").insert({ module_code: "B-E2E-001", name: project }).select("id").single();
  const alice = await createUser({ name: "Alice Group", profile: { languages: { c: 4, python: 3 }, availability: ["evening", "weekend"] } });
  const bob = await createUser({ name: "Bob Group", profile: { languages: { c: 3 }, availability: ["evening"] } });

  const a = await pageFor(browser, alice);
  await a.goto("/groups/");
  await a.locator("#req-project").selectOption(proj!.id);
  await a.locator("#req-size").fill("2");
  await a.getByRole("button", { name: "publier" }).click();
  await expect(a.getByText("ouverte")).toBeVisible();

  const b = await pageFor(browser, bob);
  await b.goto("/groups/");
  await b.locator("#find-project").selectOption(proj!.id);
  const card = b.getByTestId("candidates").getByRole("listitem").filter({ hasText: "Alice Group" });
  await expect(card).toContainText("match");
  await card.getByRole("button", { name: "rejoindre" }).click();
  await expect(b).toHaveURL(/\/groups\/chat\/\?id=/);
  await expect(b.getByRole("heading", { name: project })).toBeVisible();

  await b.getByLabel("Écris un message…").fill("salut alice");
  await b.getByRole("button", { name: "envoyer" }).click();
  await expect(b.getByTestId("chat-log")).toContainText("salut alice");

  await a.goto("/groups/");
  await expect(a.getByText("complète")).toBeVisible();
  await a.getByTestId("my-groups").getByRole("link", { name: /ouvrir le chat/ }).click();
  await expect(a.getByTestId("chat-log")).toContainText("salut alice");

  // realtime: Alice's reply shows up for Bob without reload
  await a.getByLabel("Écris un message…").fill("go pour le projet");
  await a.getByRole("button", { name: "envoyer" }).click();
  await expect(b.getByTestId("chat-log")).toContainText("go pour le projet", { timeout: 15_000 });
});

test("bocal: student takes a ticket, assistant calls them", async ({ browser }) => {
  const campus = "nice";
  const assistant = await createUser({ name: "Asse Istant", profile: { city: campus } });
  await adminClient().from("profiles").update({ role: "assistant" }).eq("id", assistant.id);
  const student = await createUser({ name: "Stu Dent", profile: { city: campus } });
  const label = `Asse-${randomUUID().slice(0, 4)}`;

  const as = await pageFor(browser, assistant);
  await as.goto("/bocal/");
  await as.getByLabel("Nom affiché").fill(label);
  await as.getByLabel("Je suis disponible").check();
  await as.getByRole("button", { name: "mettre à jour" }).click();
  await expect(as.getByTestId("assistants")).toContainText(label);

  const st = await pageFor(browser, student);
  await st.goto("/bocal/");
  await st.getByTestId("assistants").getByRole("listitem").filter({ hasText: label }).getByRole("button", { name: "prendre un ticket" }).click();
  await expect(st.getByTestId("my-ticket")).toContainText("n°1");

  await as.reload();
  await as.getByRole("button", { name: "appeler le suivant" }).click();
  await expect(st.getByTestId("my-ticket")).toBeHidden({ timeout: 15_000 });
  await st.goto("/profile/");
  await expect(st.getByTestId("notifications")).toContainText("C'est ton tour au Bocal !");
});
