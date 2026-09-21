import { defineConfig, devices } from "@playwright/test";

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined)
);

export default defineConfig({
  testDir: "./e2e-fullstack",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "fullstack-chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1280, height: 800 }
      }
    }
  ],
  webServer: {
    command: "npm --prefix .. run dev",
    url: "http://127.0.0.1:3000/health/ready",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...inheritedEnv,
      NODE_ENV: "development",
      PORT: "3000",
      CORS_ORIGINS: "http://127.0.0.1:3000",
      BACKGROUND_WORKERS_ENABLED: "false",
      WHATSAPP_NOTIFICATIONS_ENABLED: "false",
      ASAAS_API_URL: "https://api-sandbox.asaas.com/v3",
      ASAAS_API_KEY: "$aact_hmlg_ci_fullstack_placeholder",
      ASAAS_WEBHOOK_TOKEN: "ci-fullstack-webhook-token-com-mais-de-32-caracteres"
    }
  }
});
