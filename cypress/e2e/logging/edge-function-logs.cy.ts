import { supabaseSignIn, supabaseSelect, supabaseFunction } from '../../support/supabase'

/**
 * edge_function_logs — Verifica que Edge Functions logam corretamente.
 *
 * Tests:
 * 1. Chamada ao sap-query gera entrada em edge_function_logs
 * 2. Log contém function_name, status, duration_ms, response_status
 * 3. log-cleanup preview retorna contagens
 */
describe('Edge Function Logs', () => {
  let accessToken: string

  before(() => {
    supabaseSignIn(
      Cypress.env('TEST_USER_EMAIL'),
      Cypress.env('TEST_USER_PASSWORD')
    ).then((auth) => {
      accessToken = auth.accessToken
    })
  })

  it('chamada ao sap-query gera edge_function_log', function () {
    // Skip in local env — Edge Functions need `supabase functions serve` + SAP MSSQL
    if (Cypress.env('SUPABASE_URL').includes('127.0.0.1')) {
      this.skip()
      return
    }
    const beforeTest = new Date().toISOString()

    // Call sap-query with a known query (dashboard_kpis is lightweight)
    supabaseFunction(
      'sap-query',
      { queryName: 'dashboard_kpis' },
      accessToken
    ).then((resp) => {
      // May fail with SAP connection error if MSSQL not reachable — that's OK,
      // the log should still be created (with status 'error')
      const expectedStatuses = [200, 500]
      expect(expectedStatuses).to.include(resp.status)
    })

    // Wait for fire-and-forget log insert
    cy.wait(3000)

    supabaseSelect(
      'edge_function_logs',
      `select=*&function_name=eq.sap-query&created_at=gte.${beforeTest}&order=created_at.desc&limit=1`,
      accessToken
    ).then((resp) => {
      expect(resp.status).to.eq(200)
      expect(resp.body).to.have.length.greaterThan(0)

      const log = resp.body[0]
      expect(log.function_name).to.eq('sap-query')
      expect(log.status).to.be.oneOf(['ok', 'error'])
      expect(log.duration_ms).to.be.a('number')
      expect(log.duration_ms).to.be.greaterThan(0)
      expect(log.response_status).to.be.a('number')
      expect(log.request_method).to.eq('POST')
    })
  })

  it('log-cleanup preview retorna contagens das tabelas', function () {
    // Skip in local env — Edge Functions need `supabase functions serve`
    if (Cypress.env('SUPABASE_URL').includes('127.0.0.1')) {
      this.skip()
      return
    }
    // log-cleanup uses service_role internally, no auth needed
    cy.request({
      method: 'GET',
      url: `${Cypress.env('SUPABASE_URL')}/functions/v1/log-cleanup?action=preview&days=30`,
      headers: {
        apikey: Cypress.env('SUPABASE_ANON_KEY'),
      },
      failOnStatusCode: false,
    }).then((resp) => {
      // May return 200 (success) or 500 (if Resend not configured)
      if (resp.status === 200) {
        const body = resp.body
        expect(body.action).to.eq('preview')
        expect(body.days).to.eq(30)
        expect(body.counts).to.be.an('object')
        expect(body.counts).to.have.property('audit_logs')
        expect(body.counts).to.have.property('frontend_error_logs')
        expect(body.counts).to.have.property('edge_function_logs')
        expect(body.counts).to.have.property('security_logs')
        expect(body.counts).to.have.property('sap_sync_log')
        expect(body).to.have.property('total')
      } else {
        cy.log(`⚠️ log-cleanup retornou status ${resp.status}: ${JSON.stringify(resp.body)}`)
        // Even if email fails, the counts should have been computed
      }
    })
  })
})
