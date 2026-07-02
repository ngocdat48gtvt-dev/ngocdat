import { Link } from 'react-router-dom'
import { useDispatch } from '@/context/DispatchContext'
import { DispatchStatsCards } from '@/components/dispatch/DispatchStatsCards'
import { DispatchFiltersBar } from '@/components/dispatch/DispatchFiltersBar'
import { RoadStatsPanel } from '@/components/dispatch/RoadStatsPanel'
import { PageHeader } from '@/components/common/PageParts'
import { Button, Skeleton } from '@/components/ui/primitives'
import { ArrowRight } from 'lucide-react'

export function DispatchDashboardPage() {
  const { summary, roadSummaries, loading, error, reload, isCompanyAdmin, companyName } =
    useDispatch()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan điều hành"
        description={`Công ty: ${companyName} · ${isCompanyAdmin ? 'Toàn công ty' : 'Dữ liệu của bạn'}`}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
            Tải lại
          </Button>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DispatchFiltersBar />

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <DispatchStatsCards summary={summary} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Thống kê theo tuyến</h2>
        <Link
          to="/operations"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Bảng điều hành
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>

      {loading ? <Skeleton className="h-40 w-full" /> : <RoadStatsPanel roads={roadSummaries} />}
    </div>
  )
}
