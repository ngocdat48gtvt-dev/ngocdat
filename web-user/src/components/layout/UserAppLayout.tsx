import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, List, PlusCircle, BarChart3, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { to: '/', icon: Home, label: 'Trang chủ' },
  { to: '/add', icon: PlusCircle, label: 'Thêm' },
  { to: '/list', icon: List, label: 'Danh sách' },
  { to: '/stats', icon: BarChart3, label: 'Thống kê' },
  { to: '/profile', icon: User, label: 'Hồ sơ' },
]

export function UserAppLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isHome = pathname === '/' || pathname === ''

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F5]">
      {!isHome ? (
        <header className="sticky top-0 z-20 border-b border-[#DADADA] bg-white/95 px-4 py-3 backdrop-blur safe-bottom">
          <button
            type="button"
            className="text-left"
            onClick={() => navigate('/')}
          >
            <p className="text-xs text-[#666666]">Quản lý sự cố đường bộ</p>
            <h1 className="text-base font-bold text-[#1565C0]">
              {profile?.companyName || 'Hiện trường'}
            </h1>
          </button>
        </header>
      ) : null}

      <main className="mx-auto w-full max-w-lg flex-1 px-3 py-3 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-bottom">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-w-[4rem] flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[10px] font-medium transition',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
