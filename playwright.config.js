import { defineConfig, devices } from '@playwright/test';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4173/';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: 2,
  retries: 1,
  reporter: [['list']],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'celular', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true } },
    { name: 'tablet', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true } },
    { name: 'computador', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'node node_modules/http-server/bin/http-server . -p 4173 -c-1 -s', url: 'http://localhost:4173/', reuseExistingServer: true,
  },
});
