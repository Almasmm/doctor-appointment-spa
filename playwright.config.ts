import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT ?? 4173)
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`
const apiURL = process.env.VITE_API_BASE ?? 'http://127.0.0.1:3001'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run api',
      url: `${apiURL}/services`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
