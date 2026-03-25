import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    env: {
      // Default: Supabase local. Override via cypress.env.json or CLI --env
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      // Test user credentials — set in cypress.env.json (not committed)
      TEST_USER_EMAIL: '',
      TEST_USER_PASSWORD: '',
      TEST_USER_ROLE: 'diretoria',
      // Non-diretoria user for RLS tests
      TEST_LIMITED_USER_EMAIL: '',
      TEST_LIMITED_USER_PASSWORD: '',
    },
  },
})
