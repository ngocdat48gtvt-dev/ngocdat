import { useCallback, useEffect, useMemo } from 'react'
import { Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDispatch } from '@/context/DispatchContext'
import { DatePickerVi } from '@/components/ui/DatePickerVi'
import { MultiSelectVi } from '@/components/ui/MultiSelectVi'
import { Button, Card, Input, Label } from '@/components/ui/primitives'
import { emptyDispatchFilters } from '@/types/incident'

function FilterField({
  label,
  children,
  compact,
}: {
  label: string
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1.5'}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function DispatchFiltersBar({ compact = false }: { compact?: boolean }) {
  const { items, filters, setFilters, filterUserOptions } = useDispatch()

  const roadOptions = useMemo(
    () => [...new Set(items.map((i) => i.road).filter(Boolean))].sort() as string[],
    [items],
  )
  const groups = useMemo(
    () => [...new Set(items.map((i) => i.groupName).filter(Boolean))].sort() as string[],
    [items],
  )
  const types = useMemo(() => {
    const src = filters.groupName
      ? items.filter((i) => i.groupName === filters.groupName)
      : items
    return [...new Set(src.map((i) => i.type).filter(Boolean))].sort() as string[]
  }, [items, filters.groupName])

  const ownerUidOptions = useMemo(
    () => filterUserOptions.map((u) => u.uid),
    [filterUserOptions],
  )

  const getOwnerLabel = useCallback(
    (uid: string) =>
      filterUserOptions.find((u) => u.uid === uid)?.displayName ?? uid,
    [filterUserOptions],
  )

  useEffect(() => {
    if (filters.roads.length === 0) return
    const valid = filters.roads.filter((r) => roadOptions.includes(r))
    if (valid.length === filters.roads.length) return
    setFilters((f) => ({ ...f, roads: valid }))
  }, [roadOptions, filters.roads, setFilters])

  useEffect(() => {
    if (filters.types.length === 0) return
    const valid = filters.types.filter((t) => types.includes(t))
    if (valid.length === filters.types.length) return
    setFilters((f) => ({ ...f, types: valid }))
  }, [types, filters.types, setFilters])

  useEffect(() => {
    if (filters.ownerUids.length === 0) return
    const valid = filters.ownerUids.filter((uid) => ownerUidOptions.includes(uid))
    if (valid.length === filters.ownerUids.length) return
    setFilters((f) => ({ ...f, ownerUids: valid }))
  }, [ownerUidOptions, filters.ownerUids, setFilters])

  const activeCount = [
    filters.roads.length > 0 ? 'roads' : '',
    filters.chainageQuery.trim() ? 'chainage' : '',
    filters.groupName,
    filters.types.length > 0 ? 'types' : '',
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    filters.ownerUids.length > 0 ? 'owners' : '',
  ].filter(Boolean).length

  const filterByCompletedDate = filters.status === 'DONE'

  const selectClass = cn(
    'flex w-full rounded-md border border-border bg-background px-2 text-sm outline-none ring-primary focus:ring-2',
    compact ? 'h-9' : 'h-10 rounded-lg px-3',
  )

  return (
    <Card className="overflow-visible p-0 shadow-none">
      {!compact ? (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Bộ lọc</span>
          {activeCount > 0 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {activeCount} đang áp dụng
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          'grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8',
          compact ? 'gap-2 p-2' : 'gap-4 p-4',
        )}
      >
        {compact && activeCount > 0 ? (
          <div className="col-span-full flex items-center gap-1.5 pb-0.5 text-[11px] text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <span>
              Lọc: <span className="font-medium text-primary">{activeCount}</span>
            </span>
          </div>
        ) : null}
        <FilterField label="Tuyến đường" compact={compact}>
          <MultiSelectVi
            compact
            options={roadOptions}
            value={filters.roads}
            onChange={(roads) => setFilters((f) => ({ ...f, roads }))}
            placeholder="Tất cả tuyến"
            allLabel="Tất cả tuyến"
            ariaLabel="Tuyến đường"
          />
        </FilterField>
        <FilterField label="Lý trình" compact={compact}>
          <Input
            className={cn(
              'font-mono text-sm',
              compact ? 'h-9' : 'h-10',
            )}
            value={filters.chainageQuery}
            onChange={(e) =>
              setFilters((f) => ({ ...f, chainageQuery: e.target.value }))
            }
            placeholder="vd: 8+995"
            aria-label="Tìm theo lý trình"
            inputMode="text"
            autoComplete="off"
          />
        </FilterField>
        <FilterField
          label={filterByCompletedDate ? 'Từ ngày HT' : 'Từ ngày'}
          compact={compact}
        >
          <DatePickerVi
            compact
            value={filters.dateFrom}
            onChange={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
            minYear={2020}
            maxYear={2035}
          />
        </FilterField>
        <FilterField
          label={filterByCompletedDate ? 'Đến ngày HT' : 'Đến ngày'}
          compact={compact}
        >
          <DatePickerVi
            compact
            value={filters.dateTo}
            onChange={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
            minYear={2020}
            maxYear={2035}
          />
        </FilterField>
        <FilterField label="Nhóm sự cố" compact={compact}>
          <select
            className={selectClass}
            value={filters.groupName}
            onChange={(e) =>
              setFilters((f) => ({ ...f, groupName: e.target.value, types: [] }))
            }
            aria-label="Nhóm sự cố"
          >
            <option value="">Tất cả nhóm</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Loại sự cố" compact={compact}>
          <MultiSelectVi
            compact
            options={types}
            value={filters.types}
            onChange={(types) => setFilters((f) => ({ ...f, types }))}
            placeholder="Tất cả loại"
            allLabel="Tất cả loại"
            ariaLabel="Loại sự cố"
          />
        </FilterField>
        <FilterField label="Tiến độ" compact={compact}>
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            aria-label="Trạng thái"
          >
            <option value="">Tất cả</option>
            <option value="NEW">Chưa xử lý</option>
            <option value="PARTIAL">Đang xử lý</option>
            <option value="DONE">Hoàn thành</option>
          </select>
        </FilterField>
        <FilterField label="Người tạo (tên)" compact={compact}>
          <div className={cn('flex items-center gap-2', compact ? 'h-9' : 'h-10')}>
            <MultiSelectVi
              compact
              className="min-w-0 flex-1"
              options={ownerUidOptions}
              value={filters.ownerUids}
              onChange={(ownerUids) => setFilters((f) => ({ ...f, ownerUids }))}
              placeholder="Tất cả nhân sự"
              allLabel="Tất cả nhân sự"
              ariaLabel="Người tạo"
              getOptionLabel={getOwnerLabel}
            />
            <Button
              type="button"
              variant="outline"
              className={cn('shrink-0 gap-1 px-3', compact ? 'h-9' : 'h-10')}
              onClick={() => setFilters(emptyDispatchFilters)}
            >
              <X className="h-4 w-4" />
              Xóa lọc
            </Button>
          </div>
        </FilterField>
      </div>
    </Card>
  )
}
