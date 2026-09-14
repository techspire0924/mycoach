import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1,
  timeout: 30000, expect: {timeout: 8000},
  use: {baseURL:'http://127.0.0.1:4317',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects: [
    {name:'chromium',use:{...devices['Desktop Chrome']}},
    {name:'firefox',use:{...devices['Desktop Firefox']}},
    {name:'webkit',use:{...devices['Desktop Safari']}},
  ],
  webServer:{command:`${process.execPath} --import tsx tests/web-server.ts`,url:'http://127.0.0.1:4317/api/health',reuseExistingServer:false,timeout:30000},
});
