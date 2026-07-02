import { Card, Skeleton } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function StatCard({
  title,
  value,
  loading,
}: {
  title: string
  value: number | string
  loading?: boolean
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground md:text-sm">{title}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 text-2xl font-bold md:mt-2 md:text-3xl">{value}</p>
      )}
    </Card>
  )
}

export function PageHeader({ title, description, action }: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground md:mt-1">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto [&_button]:w-full sm:[&_button]:w-auto">
          {action}
        </div>
      )}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full md:h-12" />
      ))}
    </div>
  )
}

export function MobileCardList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3 md:hidden', className)}>{children}</div>
}

export function DesktopOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('hidden md:block', className)}>{children}</div>
}

export function MobileCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function MobileCardHeader({
  title,
  badge,
  subtitle,
}: {
  title: string
  badge?: React.ReactNode
  subtitle?: React.ReactNode
}) {
  return (
    <div className="mb-3 border-b border-border pb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{title}</h3>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {badge}
      </div>
    </div>
  )
}

export function MobileCardRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  )
}

export function MobileCardActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 [&>*]:min-w-0 [&_button]:w-full [&_a]:block [&_a]:w-full">
      {children}
    </div>
  )
}

export function MobileCallButton({ phone }: { phone: string }) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return null
  return (
    <a
      href={`tel:${digits}`}
      className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
    >
      Gọi {phone}
    </a>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
