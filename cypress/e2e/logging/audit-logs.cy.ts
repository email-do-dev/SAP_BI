import { supabaseSignIn, supabaseSelect } from '../../support/supabase'

/**
 * audit_logs — User activity tracking (view, navigate, export, etc.)
 *
 * Tests:
 * 1. Navegar para Dashboard gera audit_log com action 'view' e resource 'dashboard'
 * 2. Navegar para Comercial gera audit_log com action 'view' e resource 'comercial'
 * 3. audit_log contém user_email e user_agent corretos
 */
describe('Audit Logs', () => {
  let accessToken: string

  before(() => {
    supabaseSignIn(
      Cypress.env('TEST_USER_EMAIL'),
      Cypress.env('TEST_USER_PASSWORD')
    ).then((auth) => {
      accessToken = auth.accessToken
    })
  })

  beforeEach(() => {
    cy.loginViaAPI()
  })

  it('navegar para Dashboard gera audit_log com action view', () => {
    const beforeTest = new Date().toISOString()

    cy.visit('/')
    cy.waitForAppReady()
    cy.get('h1, h2').should('exist')

    cy.wait(3000)

    supabaseSelect(
      'audit_logs',
      `select=*&action=eq.view&resource=eq.dashboard&created_at=gte.${beforeTest}&order=created_at.desc&limit=1`,
      accessToken
    ).then((resp) => {
      expect(resp.status).to.eq(200)
      expect(resp.body).to.have.length.greaterThan(0)

      const log = resp.body[0]
      expect(log.action).to.eq('view')
      expect(log.resource).to.eq('dashboard')
      expect(log.user_email).to.eq(Cypress.env('TEST_USER_EMAIL'))
      expect(log.user_agent).to.not.be.undefined
    })
  })

  it('navegar para Comercial gera audit_log com action view', () => {
    const beforeTest = new Date().toISOString()

    cy.visit('/comercial')
    cy.waitForAppReady()

    cy.wait(3000)

    supabaseSelect(
      'audit_logs',
      `select=*&action=eq.view&resource=eq.comercial&created_at=gte.${beforeTest}&order=created_at.desc&limit=1`,
      accessToken
    ).then((resp) => {
      expect(resp.status).to.eq(200)
      expect(resp.body).to.have.length.greaterThan(0)

      const log = resp.body[0]
      expect(log.action).to.eq('view')
      expect(log.resource).to.eq('comercial')
      expect(log.user_email).to.eq(Cypress.env('TEST_USER_EMAIL'))
    })
  })
})
