import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// 3×2 PNG (black, white, red): cropped to a square, then re-encoded as JPEG by the page
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAE0lEQVR4nGNgYGD4DwQMYABhAQBLyAf5yr9pywAAAABJRU5ErkJggg==", "base64");

const USER = { id: "00000000-0000-4000-8000-000000000001", email: "ada@example.com", user_metadata: { full_name: "Ada Lovelace" }, aud: "authenticated", role: "authenticated" };

/** A signed-in session and a fake `budgets` table, so the account UI runs without a real Supabase. */
async function signedIn(page: Page) {
  const uploads: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/budgets**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    uploads.push(JSON.parse(req.postData() ?? "{}"));
    return route.fulfill({ status: 201, body: "" });
  });
  await page.addInitScript((user) => {
    const session = { access_token: "x", refresh_token: "y", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
    localStorage.setItem("epistudent-auth", JSON.stringify(session));
  }, USER);
  await page.goto("/");
  await expect(page.getByTestId("account-name")).toHaveText("Ada Lovelace");
  return uploads;
}

test("a nickname and a profile photo, saved with the account", async ({ guarded: page }) => {
  const uploads = await signedIn(page);

  await page.getByLabel("pseudo").fill("lovelace_42");
  await expect(page.getByTestId("account-name")).toHaveText("lovelace_42");
  await expect(page.getByTestId("account-chip")).toContainText(/lovelace_42|^l$/);

  await page.getByTestId("avatar-input").setInputFiles({ name: "moi.png", mimeType: "image/png", buffer: PNG });
  const avatar = page.getByTestId("avatar").first();
  await expect(avatar).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  expect(await avatar.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([128, 128]);
  await expect(page.getByTestId("account-chip").getByTestId("avatar")).toBeVisible();

  await expect(page.getByTestId("sync-status")).toHaveText("sauvegardé ✓");
  await expect.poll(() => uploads.at(-1)?.data).toMatchObject({ profile: { name: "lovelace_42", avatar: expect.stringMatching(/^data:image\/jpeg/) } });

  // kept after a reload and after "tout effacer"
  await page.reload();
  await expect(page.getByLabel("pseudo")).toHaveValue("lovelace_42");
  await page.getByLabel("budget du mois").fill("500");
  await page.getByTestId("reset").click();
  await page.getByTestId("reset").click();
  await expect(page.getByLabel("pseudo")).toHaveValue("lovelace_42");
  await expect(page.getByTestId("avatar").first()).toBeVisible();

  await page.getByTestId("avatar-remove").click();
  await expect(page.getByTestId("avatar")).toHaveCount(0);
});

test("a file that isn't a picture is refused", async ({ guarded: page }) => {
  await signedIn(page);
  await page.getByTestId("avatar-input").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByTestId("avatar-error")).toContainText("Choisis une image");
  await page.getByTestId("avatar-input").setInputFiles({ name: "faux.png", mimeType: "image/png", buffer: Buffer.from("pas une image") });
  await expect(page.getByTestId("avatar-error")).toContainText("Impossible de lire");
  await expect(page.getByTestId("avatar")).toHaveCount(0);
});

test("the profile never goes into a share link", async ({ guarded: page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("epistudent-plan")) localStorage.setItem("epistudent-plan", JSON.stringify({ budget: "900", profile: { name: "secret" } }));
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByTestId("share-link").click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).not.toContain("secret");
});
