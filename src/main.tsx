import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/auth-context'
import { logFrontendError } from '@/hooks/use-error-logger'
import App from './App'
import './index.css'

// Global error handlers — capture unhandled errors before React mounts
window.onerror = (_message, source, lineno, colno, error) => {
  logFrontendError({
    errorType: 'unhandled_error',
    message: error?.message ?? String(_message),
    stack: error?.stack ?? null,
    metadata: { source, lineno, colno },
  })
}

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason
  logFrontendError({
    errorType: 'unhandled_rejection',
    message: reason?.message ?? String(reason),
    stack: reason?.stack ?? null,
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
