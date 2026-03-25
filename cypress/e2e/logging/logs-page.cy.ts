import { supabaseSignIn } from '../../support/supabase'

/**
 * Página /logs — Etapa 4 do sistema de logging.
 *
 * Tests:
 * 1. Página carrega com header e KPIs
 * 2. 5 abas visíveis e navegáveis
 * 3. Cada aba renderiza DataTable com dados
 * 4. Click em linha abre dialog de detalhe
 * 5. Troca de aba via URL (persistência)
 * 6. Apenas diretoria pode acessar (usuário limitado é redirecionado)
 */
describe('Página /logs', () => {
  before(() => {
    // Seed some log data so tables are not empty
    const supabaseUrl = Cypress.env('SUPABASE_URL')
    const supabaseKey = Cypress.env('SUPABASE_ANON_KEY')

    supabaseSignIn(
      Cypress.env('TEST_USER_EMAIL'),
      Cypress.env('TEST_USER_PASSWORD')
    ).then((auth) => {
      const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }

      // Seed audit_logs
      cy.request({
        method: 'POST',
        url: `${supabaseUrl}/rest/v1/audit_logs`,
        headers,
        body: { action: 'view', resource: 'test_page', user_email: 'test-diretoria@sapbi.local', metadata: {} },
      })

      // Seed security_logs
      cy.request({
        method: 'POST',
        url: `${supabaseUrl}/rest/v1/security_logs`,
        headers,
        body: { event_type: 'login_success', user_email: 'test-diretoria@sapbi.local', metadata: {} },
      })

      // Seed frontend_error_logs
      cy.request({
        method: 'POST',
        url: `${supabaseUrl}/rest/v1/frontend_error_logs`,
        headers,
        body: { error_type: 'unhandled_error', message: 'Test error for E2E', url: 'http://localhost:5173/test', metadata: {} },
      })
    })
  })

  beforeEach(() => {
    cy.loginViaAPI()
  })

  describe('Estrutura da página', () => {
    it('carrega com header, KPIs e aba Atividades ativa por padrão', () => {
      cy.visit('/logs')
      cy.waitForAppReady()

      // Header
      cy.contains('h1', 'Logs do Sistema').should('be.visible')

      // KPI cards (5)
      cy.contains('Atividades').should('be.visible')
      cy.contains('Erros Frontend').should('be.visible')
      cy.contains('Segurança').should('be.visible')

      // Tab bar — 5 tabs
      cy.get('button').contains('Atividades').should('be.visible')
      cy.get('button').contains('Erros Frontend').should('be.visible')
      cy.get('button').contains('Sync SAP').should('be.visible')
      cy.get('button').contains('Edge Functions').should('be.visible')
      cy.get('button').contains('Segurança').should('be.visible')

      // Default tab active (Atividades) has primary styling
      cy.get('button').contains('Atividades')
        .should('have.class', 'border-primary')

      // DataTable visible with search input
      cy.get('input[placeholder*="Buscar"]').should('be.visible')
    })
  })

  describe('Navegação entre abas', () => {
    it('clicar em cada aba atualiza a URL e mostra tabela correspondente', () => {
      cy.visit('/logs')
      cy.waitForAppReady()

      // Click Erros Frontend
      cy.get('button').contains('Erros Frontend').click()
      cy.url().should('include', 'tab=erros')
      cy.get('input[placeholder*="Buscar erro"]').should('be.visible')

      // Click Sync SAP
      cy.get('button').contains('Sync SAP').click()
      cy.url().should('include', 'tab=sync')
      cy.get('input[placeholder*="Buscar sync"]').should('be.visible')

      // Click Edge Functions
      cy.get('button').contains('Edge Functions').click()
      cy.url().should('include', 'tab=edge')
      cy.get('input[placeholder*="Buscar fun"]').should('be.visible')

      // Click Segurança
      cy.get('button').contains('Segurança').click()
      cy.url().should('include', 'tab=seguranca')
      cy.get('input[placeholder*="Buscar evento"]').should('be.visible')

      // Back to Atividades
      cy.get('button').contains('Atividades').first().click()
      cy.url().should('include', 'tab=atividades')
    })

    it('aba é preservada ao recarregar a página', () => {
      cy.visit('/logs?tab=seguranca')
      cy.waitForAppReady()

      cy.get('button').contains('Segurança')
        .should('have.class', 'border-primary')
      cy.get('input[placeholder*="Buscar evento"]').should('be.visible')
    })
  })

  describe('Dados nas tabelas', () => {
    it('aba Atividades mostra registros de audit_logs', () => {
      cy.visit('/logs?tab=atividades')
      cy.waitForAppReady()

      // Should have at least the seeded row
      cy.contains('td', 'test_page').should('exist')
    })

    it('aba Erros Frontend mostra registros de frontend_error_logs', () => {
      cy.visit('/logs?tab=erros')
      cy.waitForAppReady()

      cy.contains('td', 'Test error for E2E').should('exist')
    })

    it('aba Segurança mostra registros de security_logs', () => {
      cy.visit('/logs?tab=seguranca')
      cy.waitForAppReady()

      cy.contains('login_success').should('exist')
    })
  })

  describe('Dialogs de detalhe', () => {
    it('clicar em linha de Atividades abre dialog com detalhes', () => {
      cy.visit('/logs?tab=atividades')
      cy.waitForAppReady()

      // Click first row
      cy.contains('td', 'test_page').click()

      // Dialog should open
      cy.contains('Detalhe da Atividade').should('be.visible')
      cy.contains('test_page').should('be.visible')
    })

    it('clicar em linha de Erros abre ErrorDetailDialog com stack info', () => {
      cy.visit('/logs?tab=erros')
      cy.waitForAppReady()

      cy.contains('td', 'Test error for E2E').click()

      cy.contains('Erro:').should('be.visible')
      cy.contains('Test error for E2E').should('be.visible')
    })

    it('clicar em linha de Segurança abre dialog de evento', () => {
      cy.visit('/logs?tab=seguranca')
      cy.waitForAppReady()

      cy.contains('login_success').first().click()

      cy.contains('Evento de Segurança').should('be.visible')
    })
  })

  describe('Acesso restrito', () => {
    it('usuário sem diretoria é redirecionado ao acessar /logs', function () {
      const limitedEmail = Cypress.env('TEST_LIMITED_USER_EMAIL')
      const limitedPassword = Cypress.env('TEST_LIMITED_USER_PASSWORD')

      if (!limitedEmail || !limitedPassword) {
        this.skip()
        return
      }

      // Login as limited user
      cy.loginViaAPI(limitedEmail, limitedPassword)
      cy.visit('/logs')

      // Should redirect away from /logs
      cy.url().should('not.include', '/logs', { timeout: 10000 })
    })
  })
})
