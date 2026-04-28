import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const systemChromePath = process.env.ROAST_PLAYWRIGHT_CHROME || '';

const projects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1280, height: 900 }
    }
  },
  {
    name: 'mobile-chromium',
    use: {
      ...devices['Pixel 5']
    }
  },
  systemChromePath
    ? {
        name: 'chromium-windows',
        use: {
          ...devices['Desktop Chrome'],
          viewport: { width: 1280, height: 900 },
          launchOptions: {
            executablePath: systemChromePath
          }
        }
      }
    : null
].filter(Boolean);

export default defineConfig({
  testDir: './tests/functional',
  timeout: 45_000,
  expect: {
    timeout: 7_500
  },
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects,
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run serve:static',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000
      }
});
