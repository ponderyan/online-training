import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },

  projects: [
    // Auth Setup
    { name: 'setup-admin', testMatch: /auth\/admin\.setup\.ts/ },
    { name: 'setup-student', testMatch: /auth\/student\.setup\.ts/ },
    { name: 'setup-exam-officer', testMatch: /auth\/exam-officer\.setup\.ts/ },
    { name: 'setup-lecturer', testMatch: /auth\/lecturer\.setup\.ts/ },

    // Business Tests
    {
      name: 'login-permission',
      testMatch: /login-permission\.spec\.ts/,
    },
    {
      name: 'exam-flow',
      testMatch: /exam-flow\.spec\.ts/,
      dependencies: ['setup-admin', 'setup-student', 'setup-exam-officer'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
    {
      name: 'grading-flow',
      testMatch: /grading-flow\.spec\.ts/,
      dependencies: ['setup-admin', 'setup-student', 'setup-lecturer'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
    {
      name: 'question-paper',
      testMatch: /question-paper\.spec\.ts/,
      dependencies: ['setup-admin', 'setup-lecturer'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
    {
      name: 'program-lifecycle',
      testMatch: /program-lifecycle\.spec\.ts/,
      dependencies: ['setup-admin', 'setup-student'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
    {
      name: 'mobile-smoke',
      testMatch: /mobile-smoke\.spec\.ts/,
      dependencies: ['setup-admin'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
    {
      name: 'org-codes',
      testMatch: /org-codes\.spec\.ts/,
      dependencies: ['setup-admin'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
    {
      name: 'mobile-devices-smoke',
      testMatch: /mobile-devices-smoke\.spec\.ts/,
      dependencies: ['setup-admin'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
    {
      name: 'practice',
      testMatch: /practice\.spec\.ts/,
      dependencies: ['setup-admin', 'setup-student'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
    {
      name: 'certificate-hours',
      testMatch: /certificate-hours\.spec\.ts/,
      dependencies: ['setup-admin', 'setup-student'],
      use: { storageState: 'e2e/auth/.auth/admin.json' },
    },
  ],
});
