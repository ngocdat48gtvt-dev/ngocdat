import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  List,
  BookOpen,
  ClipboardList,
  KeyRound,
  LogOut,
  Moon,
  Sun,
  Trash2,
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/firebase'
import { clearPortalSession, DIEU_HANH_PORTAL } from '@/lib/portalAuth'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { PortalHomeLink } from '@/components/layout/PortalHomeLink'
import { useAuth, useTheme } from '@/hooks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'
import { toast } from 'sonner'

const tabs = [
  { to: '/', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/operations', label: 'Điều hành sự cố', shortLabel: 'Điều hành', icon: List, end: false },
  { to: '/trash', label: 'Thùng rác', shortLabel: 'Thùng rác', icon: Trash2, end: false },
  {
    to: '/rework',
    label: 'Yêu cầu bổ sung',
    shortLabel: 'Bổ sung',
    icon: ClipboardList,
    end: false,
    adminOnly: true,
  },
  { to: '/catalog', label: 'Danh mục', shortLabel: 'Danh mục', icon: BookOpen, end: false, adminOnly: true },
]

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const { profile, isCompanyAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [changePassOpen, setChangePassOpen] = useState(false)

  const isOperations = location.pathname === '/operations'
  const pageTitle =
    location.pathname === '/catalog'
      ? 'Quản lý danh mục'
      : location.pathname === '/rework'
        ? 'Yêu cầu bổ sung'
        : location.pathname === '/trash'
          ? 'Thùng rác'
          : location.pathname === '/'
          ? 'Tổng quan'
          : ''

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isCompanyAdmin)

  async function logout() {
    clearPortalSession(DIEU_HANH_PORTAL)
    await signOut(auth)
    toast.success('Đã đăng xuất')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-background md:h-dvh md:max-h-dvh md:overflow-hidden">
      <aside className="hidden h-full w-64 shrink-0 overflow-y-auto border-r border-border bg-card p-4 md:block">
        <div className="mb-8 px-2">
          <div className="mb-3 flex items-center gap-2.5">
            <PortalHomeLink />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Điều hành</p>
          </div>
          <h1 className="text-lg font-bold">{profile?.companyName ?? 'Công ty'}</h1>
          <p className="text-xs text-muted-foreground">Lãnh đạo (ADMIN)</p>
        </div>
        <nav className="space-y-1">
          {visibleTabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          isOperations
            ? 'max-h-[100dvh] overflow-hidden max-md:h-[100dvh]'
            : 'min-h-0',
          'md:h-full md:max-h-full',
        )}
      >
        <header
          className={cn(
            'z-40 flex shrink-0 items-center justify-between border-b border-border bg-card/95 px-3 backdrop-blur md:sticky md:top-0 md:px-4',
            isOperations ? 'py-1.5' : 'py-2.5 md:py-3',
          )}
        >
          <div className="flex min-w-0 items-center gap-2 md:block">
            <PortalHomeLink className="md:hidden" />
            {pageTitle ? (
              <p className="truncate text-base font-semibold md:text-lg">{pageTitle}</p>
            ) : null}
            <p
              className={cn(
                'text-xs text-muted-foreground',
                pageTitle ? 'md:hidden' : 'truncate',
              )}
            >
              {profile?.companyName}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} type="button">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setChangePassOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Mật khẩu</span>
            </Button>
            <Button variant="outline" size="sm" onClick={logout} type="button">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </Button>
          </div>
        </header>
        <ChangePasswordDialog open={changePassOpen} onClose={() => setChangePassOpen(false)} />
        <main
          className={cn(
            'flex min-h-0 flex-1 flex-col pb-28 md:pb-3',
            isOperations
              ? 'overflow-hidden p-2 md:p-3'
              : 'overflow-auto p-3 md:p-6',
          )}
        >
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex max-w-lg">
          {visibleTabs.map(({ to, shortLabel, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted/60',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="truncate">{shortLabel}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
