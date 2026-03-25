import { supabaseSignIn, supabaseSelect } from '../../support/supabase'

/**
 * security_logs — Login/logout/access_denied events.
 *
 * Tests:
 * 1. Login via UI gera evento login_success
 * 2. Login com senha errada gera evento login_failure
 * 3. Logout gera evento logout
 */
describe('Security Logs', () => {
  let accessToken: string

  before(() => {
    // Get a token to query logs after tests
    supabaseSignIn(
      Cypress.env('TEST_USER_EMAIL'),
      Cypress.env('TEST_USER_PASSWORD')
    ).then((auth) => {
      accessToken = auth.accessToken
    })
  })

  it('login via UI gera security_log com event_type login_success', () => {
    const beforeTest = new Date().toISOString()

    cy.loginViaUI()
    cy.url().should('eq', Cypress.config('baseUrl') + '/')

    // Wait for fire-and-forget insert to complete
    cy.wait(2000)

    // Query security_logs for the login event
    supabaseSelect(
      'security_logs',
      `select=*&event_type=eq.login_success&user_email=eq.${encodeURIComponent(Cypress.env('TEST_USER_EMAIL'))}&created_at=gte.${beforeTest}&order=created_at.desc&limit=1`,
      accessToken
    ).then((resp) => {
      expect(resp.status).to.eq(200)
      expect(resp.body).to.have.length.greaterThan(0)

      const log = resp.body[0]
      expect(log.event_type).to.eq('login_success')
      expect(log.user_email).to.eq(Cypress.env('TEST_USER_EMAIL'))
      expect(log.user_id).to.not.be.undefined
    })
  })

  it('login com senha errada gera security_log com event_type login_failure', () => {
    const beforeTest = new Date().toISOString()

    cy.visit('/login')
    cy.get('input#email').clear().type(Cypress.env('TEST_USER_EMAIL'))
    cy.get('input#password').clear().type('senha_errada_12345')
    cy.get('button[type="submit"]').click()

    // Should show error and stay on login page
    cy.get('[class*="destructive"]').should('be.visible')
    cy.url().should('include', '/login')

    cy.wait(2000)

    supabaseSelect(
      'security_logs',
      `select=*&event_type=eq.login_failure&user_email=eq.${encodeURIComponent(Cypress.env('TEST_USER_EMAIL'))}&created_at=gte.${beforeTest}&order=created_at.desc&limit=1`,
      accessToken
    ).then((resp) => {
      expect(resp.status).to.eq(200)
      expect(resp.body).to.have.length.greaterThan(0)

      const log = resp.body[0]
      expect(log.event_type).to.eq('login_failure')
      expect(log.metadata).to.have.property('reason')
    })
  })

  it('logout gera security_log com event_type logout', () => {
    cy.loginViaUI()
    cy.url().should('not.include', '/login')

    const beforeLogout = new Date().toISOString()

    // Click logout in sidebar
    cy.contains('button', 'Sair').click()

    // Should redirect to login
    cy.url().should('include', '/login', { timeout: 10000 })

    cy.wait(2000)

    supabaseSelect(
      'security_logs',
      `select=*&event_type=eq.logout&user_email=eq.${encodeURIComponent(Cypress.env('TEST_USER_EMAIL'))}&created_at=gte.${beforeLogout}&order=created_at.desc&limit=1`,
      accessToken
    ).then((resp) => {
      expect(resp.status).to.eq(200)
      expect(resp.body).to.have.length.greaterThan(0)

      const log = resp.body[0]
      expect(log.event_type).to.eq('logout')
    })
  })
})
