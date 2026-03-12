function getEnvVar(name: string): string {
  const value = import.meta.env[name]
  if (!value) {
    const msg = `Missing environment variable: ${name}. Check your .env file.`
    document.body.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#dc2626"><h1>Configuration Error</h1><p>${msg}</p><p>Copy <code>.env.example</code> to <code>.env</code> and fill in the values.</p></div>`
    throw new Error(msg)
  }
  return value
}

export const env = {
  SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY'),
} as const
