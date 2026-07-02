import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '@/hooks'
import { AppLayout } from '@/components/layout/AppLayout'
import { DispatchLayout } from '@/components/layout/DispatchLayout'
import { DispatchDashboardPage } from '@/pages/dispatch/DispatchDashboardPage'
import { DispatchOperationsPage } from '@/pages/dispatch/DispatchOperationsPage'
import { DispatchCatalogPage } from '@/pages/dispatch/DispatchCatalogPage'
import { DispatchReworkPage } from '@/pages/dispatch/DispatchReworkPage'
import { DispatchTrashPage } from '@/pages/dispatch/DispatchTrashPage'
import { LoginPage } from '@/pages/LoginPage'
import { Skeleton } from '@/components/ui/primitives'

function ProtectedRoute() {
  const { user, loading, canAccess } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6">
        <Skeleton className="h-10 w-48" />
        <p className="text-sm text-muted-foreground">Đang kiểm tra quyền...</p>
      </div>
    )
  }
  if (!user || !canAccess) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route element={<DispatchLayout />}>
              <Route index element={<DispatchDashboardPage />} />
              <Route path="operations" element={<DispatchOperationsPage />} />
              <Route path="catalog" element={<DispatchCatalogPage />} />
              <Route path="rework" element={<DispatchReworkPage />} />
              <Route path="trash" element={<DispatchTrashPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  )
}
