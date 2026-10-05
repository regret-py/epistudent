import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    // French is the product default; tests opt into English explicitly.
    locale: "fr-FR",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], locale: "fr-FR" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], locale: "fr-FR" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // `next start` needs a prior `next build`; CI builds in an earlier step.
        command: `pnpm exec next start -p ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
