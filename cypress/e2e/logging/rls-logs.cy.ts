import { supabaseSignIn, supabaseSelect } from '../../support/supabase'

/**
 * RLS (Row Level Security) — Verifica que apenas usuários com role 'diretoria'
 * conseguem ler as tabelas de log.
 *
 * Requer TEST_LIMITED_USER (sem role diretoria) configurado em cypress.env.json.
 */
describe('RLS nas tabelas de log', () => {
  const logTables = [
    'audit_logs',
    'security_logs',
    'frontend_error_logs',
    'edge_function_logs',
  ]

  describe('Usuário diretoria consegue ler logs', () => {
    let accessToken: string

    before(() => {
      supabaseSignIn(
        Cypress.env('TEST_USER_EMAIL'),
        Cypress.env('TEST_USER_PASSWORD')
      ).then((auth) => {
        accessToken = auth.accessToken
      })
    })

    logTables.forEach((table) => {
      it(`pode fazer SELECT em ${table}`, () => {
        supabaseSelect(table, 'select=id&limit=1', accessToken).then(
          (resp) => {
            // 200 = access OK (even if empty array)
            expect(resp.status).to.eq(200)
            expect(resp.body).to.be.an('array')
          }
        )
      })
    })
  })

  describe('Usuário sem diretoria NÃO consegue ler logs', () => {
    let limitedToken: string

    before(function () {
      const email = Cypress.env('TEST_LIMITED_USER_EMAIL')
      const password = Cypress.env('TEST_LIMITED_USER_PASSWORD')

      if (!email || !password) {
        this.skip()
        return
      }

      supabaseSignIn(email, password).then((auth) => {
        limitedToken = auth.accessToken
      })
    })

    logTables.forEach((table) => {
      it(`SELECT em ${table} retorna array vazio (RLS bloqueia)`, () => {
        supabaseSelect(table, 'select=id&limit=5', limitedToken).then(
          (resp) => {
            // RLS doesn't return 403 — it returns 200 with empty array
            expect(resp.status).to.eq(200)
            expect(resp.body).to.be.an('array')
            expect(resp.body).to.have.length(0)
          }
        )
      })
    })
  })

  describe('Usuário autenticado pode INSERIR logs (write policy)', () => {
    let accessToken: string

    before(() => {
      // Use the limited user to test insert capability
      const email =
        Cypress.env('TEST_LIMITED_USER_EMAIL') ||
        Cypress.env('TEST_USER_EMAIL')
      const password =
        Cypress.env('TEST_LIMITED_USER_PASSWORD') ||
        Cypress.env('TEST_USER_PASSWORD')

      supabaseSignIn(email, password).then((auth) => {
        accessToken = auth.accessToken
      })
    })

    it('pode inserir em security_logs', () => {
      const supabaseUrl = Cypress.env('SUPABASE_URL')
      const supabaseKey = Cypress.env('SUPABASE_ANON_KEY')

      cy.request({
        method: 'POST',
        url: `${supabaseUrl}/rest/v1/security_logs`,
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: {
          event_type: 'login_success',
          user_email: 'cypress-test@test.com',
          metadata: { source: 'cypress_e2e_test' },
        },
        failOnStatusCode: false,
      }).then((resp) => {
        // 201 Created = insert policy works
        expect(resp.status).to.eq(201)
      })
    })

    it('pode inserir em audit_logs', () => {
      const supabaseUrl = Cypress.env('SUPABASE_URL')
      const supabaseKey = Cypress.env('SUPABASE_ANON_KEY')

      cy.request({
        method: 'POST',
        url: `${supabaseUrl}/rest/v1/audit_logs`,
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: {
          action: 'view',
          resource: 'cypress_test',
          metadata: { source: 'cypress_e2e_test' },
        },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(201)
      })
    })
  })
})
