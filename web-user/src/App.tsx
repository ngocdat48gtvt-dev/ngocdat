import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { UserAppLayout } from '@/components/layout/UserAppLayout'
import { useAuth } from '@/hooks/useAuth'
import { LoginPage } from '@/pages/LoginPage'
import { HomePage } from '@/pages/HomePage'
import { AddIncidentPage } from '@/pages/AddIncidentPage'
import { IncidentListPage } from '@/pages/IncidentListPage'
import { IncidentDetailPage } from '@/pages/IncidentDetailPage'
import { StatsPage } from '@/pages/StatsPage'
import { ProfilePage } from '@/pages/ProfilePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, canAccess } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Đang kiểm tra đăng nhập...
      </div>
    )
  }
  if (!canAccess) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <UserAppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="add" element={<AddIncidentPage />} />
            <Route path="list" element={<IncidentListPage />} />
            <Route path="incidents/:id" element={<IncidentDetailPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toaster richColors position="top-center" />
    </ErrorBoundary>
  )
}
