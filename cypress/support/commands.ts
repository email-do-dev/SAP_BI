/// <reference types="cypress" />

/**
 * Custom Cypress commands for SAP BI E2E tests.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Login via UI (fills the login form).
       */
      loginViaUI(email?: string, password?: string): Chainable<void>

      /**
       * Login via Supabase API (faster, no UI interaction).
       * Sets the session in localStorage so the app picks it up.
       */
      loginViaAPI(email?: string, password?: string): Chainable<void>

      /**
       * Wait for the app to finish loading (spinner disappears).
       */
      waitForAppReady(): Chainable<void>
    }
  }
}

Cypress.Commands.add('loginViaUI', (email?: string, password?: string) => {
  const userEmail = email ?? Cypress.env('TEST_USER_EMAIL')
  const userPassword = password ?? Cypress.env('TEST_USER_PASSWORD')

  cy.visit('/login')
  cy.get('input#email').clear().type(userEmail)
  cy.get('input#password').clear().type(userPassword)
  cy.get('button[type="submit"]').click()
  // Wait for redirect to dashboard
  cy.url().should('not.include', '/login', { timeout: 15000 })
})

Cypress.Commands.add('loginViaAPI', (email?: string, password?: string) => {
  const userEmail = email ?? Cypress.env('TEST_USER_EMAIL')
  const userPassword = password ?? Cypress.env('TEST_USER_PASSWORD')
  const supabaseUrl = Cypress.env('SUPABASE_URL')
  const supabaseKey = Cypress.env('SUPABASE_ANON_KEY')

  cy.request({
    method: 'POST',
    url: `${supabaseUrl}/auth/v1/token?grant_type=password`,
    headers: {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    },
    body: { email: userEmail, password: userPassword },
  }).then((resp) => {
    expect(resp.status).to.eq(200)
    const { access_token, refresh_token, expires_in, user } = resp.body

    // Build the storage key Supabase JS client uses
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
    const session = {
      access_token,
      refresh_token,
      expires_in,
      expires_at: Math.floor(Date.now() / 1000) + expires_in,
      token_type: 'bearer',
      user,
    }

    window.localStorage.setItem(storageKey, JSON.stringify(session))
  })
})

Cypress.Commands.add('waitForAppReady', () => {
  // Wait for auth loading spinner to disappear
  cy.get('[class*="animate-spin"]', { timeout: 10000 }).should('not.exist')
})

export {}
