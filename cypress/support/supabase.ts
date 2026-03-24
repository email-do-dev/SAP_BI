/**
 * Supabase helper for Cypress tests.
 * Uses direct REST API calls (no SDK import needed in Cypress).
 */

function supabaseUrl(): string {
  return Cypress.env('SUPABASE_URL')
}

function supabaseKey(): string {
  return Cypress.env('SUPABASE_ANON_KEY')
}

function headers(accessToken?: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: supabaseKey(),
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
  if (accessToken) {
    h['Authorization'] = `Bearer ${accessToken}`
  }
  return h
}

/**
 * Sign in via Supabase Auth REST API, returns access_token + user.
 */
export function supabaseSignIn(email: string, password: string) {
  return cy
    .request({
      method: 'POST',
      url: `${supabaseUrl()}/auth/v1/token?grant_type=password`,
      headers: headers(),
      body: { email, password },
    })
    .then((resp) => {
      expect(resp.status).to.eq(200)
      return {
        accessToken: resp.body.access_token as string,
        user: resp.body.user as { id: string; email: string },
      }
    })
}

/**
 * Query a Supabase table via REST API (PostgREST).
 * Uses the user's access token so RLS applies.
 */
export function supabaseSelect(
  table: string,
  query: string,
  accessToken: string
) {
  return cy.request({
    method: 'GET',
    url: `${supabaseUrl()}/rest/v1/${table}?${query}`,
    headers: headers(accessToken),
    failOnStatusCode: false,
  })
}

/**
 * Delete rows from a Supabase table (for cleanup).
 */
export function supabaseDelete(
  table: string,
  query: string,
  accessToken: string
) {
  return cy.request({
    method: 'DELETE',
    url: `${supabaseUrl()}/rest/v1/${table}?${query}`,
    headers: headers(accessToken),
    failOnStatusCode: false,
  })
}

/**
 * Call an Edge Function.
 */
export function supabaseFunction(
  functionName: string,
  body: Record<string, unknown>,
  accessToken?: string
) {
  return cy.request({
    method: 'POST',
    url: `${supabaseUrl()}/functions/v1/${functionName}`,
    headers: headers(accessToken),
    body,
    failOnStatusCode: false,
  })
}
