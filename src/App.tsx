import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { ProtectedRoute } from '@/components/layout/protected-route'
import { logFrontendError } from '@/hooks/use-error-logger'

function lazyRetry(importFn: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    importFn().catch((err) => {
      const isChunkError = err?.name === 'ChunkLoadError' ||
        String(err?.message).includes('Failed to fetch dynamically imported module')
      logFrontendError({
        errorType: isChunkError ? 'chunk_load_error' : 'lazy_retry_fail',
        message: err?.message ?? 'Unknown lazy load error',
        stack: err?.stack ?? null,
      })
      window.location.reload()
      return new Promise(() => {})
    })
  )
}

const LoginPage = lazyRetry(() => import('@/pages/login'))
const DashboardPage = lazyRetry(() => import('@/pages/dashboard'))
const ComercialPage = lazyRetry(() => import('@/pages/comercial'))
const LogisticaPage = lazyRetry(() => import('@/pages/logistica'))
const DevolucoesPage = lazyRetry(() => import('@/pages/devolucoes'))
const CustoLogisticoPage = lazyRetry(() => import('@/pages/custo-logistico'))
const UsuariosPage = lazyRetry(() => import('@/pages/usuarios'))
const ImportacaoListPage = lazyRetry(() => import('@/pages/importacao/index'))
const ImportacaoNovoPage = lazyRetry(() => import('@/pages/importacao/novo'))
const ImportacaoDetailPage = lazyRetry(() => import('@/pages/importacao/detail'))
const ProducaoPage = lazyRetry(() => import('@/pages/producao'))

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logFrontendError({
      errorType: 'error_boundary',
      message: error.message,
      stack: error.stack ?? null,
      componentStack: errorInfo.componentStack ?? null,
    })
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <p className="text-lg text-muted-foreground">Erro ao carregar a aplicação.</p>
          <button className="rounded bg-primary px-4 py-2 text-white" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route
            path="comercial"
            element={
              <ProtectedRoute requiredRoles={['diretoria', 'comercial']}>
                <ComercialPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="logistica"
            element={
              <ProtectedRoute requiredRoles={['diretoria', 'logistica']}>
                <LogisticaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="producao"
            element={
              <ProtectedRoute requiredRoles={['diretoria', 'producao']}>
                <ProducaoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="devolucoes"
            element={
              <ProtectedRoute requiredRoles={['diretoria', 'comercial', 'financeiro']}>
                <DevolucoesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="custo-logistico"
            element={
              <ProtectedRoute requiredRoles={['diretoria', 'logistica', 'financeiro']}>
                <CustoLogisticoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute requiredRoles={['diretoria']}>
                <UsuariosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="importacao"
            element={
              <ProtectedRoute requiredRoles={['diretoria', 'importacao', 'financeiro']}>
                <ImportacaoListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="importacao/novo"
            element={
              <ProtectedRoute requiredRoles={['diretoria', 'importacao']}>
                <ImportacaoNovoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="importacao/:id"
            element={
              <ProtectedRoute requiredRoles={['diretoria', 'importacao', 'financeiro']}>
                <ImportacaoDetailPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}
