import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Plus } from 'lucide-react'
import { useIncidents } from '@/hooks/useIncidents'
import { useAuth } from '@/hooks/useAuth'
import { useWeather } from '@/hooks/useWeather'
import { buildTodayStatsText } from '@/lib/homeTodayStats'
import { formatViDayDateString, todayViDateString } from '@/lib/incidentUtils'
import { cn } from '@/lib/utils'
import bannerImg from '@/assets/banner2.png'

const APP_VERSION = '1.0.0'

function HomeActionButton({
  label,
  onClick,
  icon,
  variant = 'primary',
}: {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: 'primary' | 'muted'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-14 items-center justify-center gap-2 rounded-lg px-2 text-sm font-bold text-white shadow-sm transition active:opacity-90',
        variant === 'primary' ? 'bg-[#1565C0]' : 'bg-[#757575]',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items } = useIncidents(user?.uid)
  const weather = useWeather()
  const today = todayViDateString()
  const statsText = useMemo(
    () => buildTodayStatsText(items, today),
    [items, today],
  )

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl shadow-sm">
        <div className="relative h-[188px]">
          <img
            src={bannerImg}
            alt="Banner quản lý sự cố đường bộ"
            className="h-full w-full object-cover"
          />
          <h2
            className="absolute inset-x-0 top-0 px-3 pt-3 text-center text-lg font-bold text-white"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
          >
            QUẢN LÝ SỰ CỐ ĐƯỜNG BỘ
          </h2>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-md">
        <p className="text-sm text-[#666666]">{formatViDayDateString()}</p>
        <p className="mt-1 text-sm text-[#1A1A2E]">
          {weather.loading ? 'Đang tải thời tiết…' : weather.weatherText}
        </p>
        {weather.place ? (
          <p className="mt-0.5 text-[13px] text-[#666666]">{weather.place}</p>
        ) : null}

        <div className="my-3 h-px bg-[#DADADA]" />

        <p className="mb-2 text-[17px] font-bold text-[#1A1A2E]">
          📊 THỐNG KÊ HÔM NAY
        </p>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1A1A2E]">
          {statsText}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <HomeActionButton
          label="Thống kê"
          icon={<BarChart3 className="h-6 w-6 shrink-0" strokeWidth={2.25} />}
          onClick={() => navigate('/stats')}
        />
        <HomeActionButton
          label="Thêm sự cố"
          icon={<Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} />}
          onClick={() => navigate('/add')}
        />
        <HomeActionButton
          label="📋 Danh sách"
          onClick={() => navigate('/list')}
        />
        <HomeActionButton
          label="⚙ Cài đặt"
          variant="muted"
          onClick={() => navigate('/profile')}
        />
      </div>

      <div className="rounded-lg bg-[#FFF3E0] px-2.5 py-2.5 text-center text-[15px] font-bold text-[#E65100]">
        Web hiện trường v{APP_VERSION}
      </div>
    </div>
  )
}
