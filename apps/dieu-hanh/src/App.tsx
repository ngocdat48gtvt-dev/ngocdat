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
import { Skeleton } from '@/components/ui/primitives'

const PORTAL_HOME_URL = '/quan-ly-duong-bo.html'

function PortalRedirect({ denied = false }: { denied?: boolean }) {
  const target = denied ? `${PORTAL_HOME_URL}?denied=dieu-hanh` : `${PORTAL_HOME_URL}?login=1`
  window.location.replace(target)
  return null
}

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
  if (!user) return <PortalRedirect />
  if (!canAccess) return <PortalRedirect denied />
  return <Outlet />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<PortalRedirect />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  )
}
