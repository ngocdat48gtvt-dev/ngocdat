import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, ImageIcon, Loader2, Star, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'

type SelectionKind = 'before' | 'after'

export type GallerySelection = {
  beforeUrls: string[]
  afterUrls: string[]
  /** STT ghép Word (1-based) — hiển thị trên thumbnail đã chọn. */
  orderIndex?: (kind: SelectionKind, url: string) => number | undefined
  onOrderChange?: (kind: SelectionKind, url: string, order: number) => void
  onToggle: (kind: SelectionKind, url: string) => void
  onSelectAll: (kind: SelectionKind) => void
  onClearAll: (kind: SelectionKind) => void
}

type LightboxItem = {
  url: string
  /** Nhóm ảnh (để chọn ảnh báo cáo đúng before/after). */
  kind?: SelectionKind
  /** Nhãn hiển thị trên đầu lightbox (vd "Hiện trạng"/"Sau xử lý"). */
  label: string
}

type LightboxState = {
  items: LightboxItem[]
  index: number
}

function ThumbnailTile({
  url,
  index,
  title,
  onOpen,
  selected = false,
  onSelect,
  mergeOrder,
  onOrderChange,
  onDelete,
  deleting,
}: {
  url: string
  index: number
  title: string
  onOpen: () => void
  selected?: boolean
  onSelect?: () => void
  mergeOrder?: number
  onOrderChange?: (order: number) => void
  onDelete?: () => void
  deleting?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [orderDraft, setOrderDraft] = useState(String(mergeOrder ?? ''))

  useEffect(() => {
    setOrderDraft(mergeOrder != null ? String(mergeOrder) : '')
  }, [mergeOrder])

  function commitOrder() {
    if (!onOrderChange) return
    const n = parseInt(orderDraft, 10)
    if (!Number.isFinite(n) || n < 1) {
      setOrderDraft(mergeOrder != null ? String(mergeOrder) : '1')
      return
    }
    onOrderChange(n)
  }

  return (
    <div
      className={cn(
        'group relative flex w-[140px] shrink-0 flex-col overflow-hidden rounded-xl border border-border',
        'bg-muted/40 shadow-sm transition hover:border-primary/40 hover:shadow-md',
        'sm:w-[168px]',
        selected && 'border-2 border-amber-500 ring-2 ring-amber-400/50',
      )}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className={cn(
            'absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow transition',
            selected
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-white/90 bg-black/35 text-white/90 hover:bg-amber-500 hover:border-amber-500',
          )}
          title={selected ? 'Ảnh đang chọn cho báo cáo Word' : 'Chọn ảnh này cho báo cáo Word'}
          aria-label={selected ? 'Ảnh đang chọn cho báo cáo' : 'Chọn ảnh cho báo cáo'}
          aria-pressed={selected}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={cn(
            'absolute bottom-8 left-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow transition',
            'border-white/90 bg-red-600/90 text-white hover:bg-red-700 disabled:opacity-60',
          )}
          title="Xóa ảnh"
          aria-label={`Xóa ${title} — ảnh ${index + 1}`}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
      {selected && mergeOrder != null ? (
        <span className="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow">
          {mergeOrder}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="block w-full"
        aria-label={`${title} — ảnh ${index + 1}`}
      >
      <div className="relative aspect-[9/16] w-full bg-muted/60">
        {!loaded && !error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin opacity-70" />
            <span className="text-[10px]">Đang tải…</span>
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-60" strokeWidth={1.5} />
            <span className="text-[10px]">Không tải được</span>
            <span className="text-[10px] text-primary">Bấm thử lại</span>
          </div>
        ) : (
          <img
            src={url}
            alt={`${title} ${index + 1}`}
            loading="lazy"
            decoding="async"
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => {
              setLoaded(true)
              setError(false)
            }}
            onError={() => {
              setError(true)
              setLoaded(false)
            }}
          />
        )}
        <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5 text-left text-[10px] font-medium text-white">
          Ảnh {index + 1}
        </span>
      </div>
      </button>
      {selected && onOrderChange ? (
        <div
          className="flex items-center justify-center gap-1.5 border-t border-amber-300/80 bg-amber-50 px-2 py-1.5 dark:bg-amber-950/40"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="text-[10px] font-semibold text-amber-900 dark:text-amber-100">
            STT
          </label>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            className="h-7 w-12 rounded border border-amber-400 bg-white text-center text-sm font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-400 dark:bg-background"
            value={orderDraft}
            onChange={(e) => setOrderDraft(e.target.value)}
            onBlur={commitOrder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitOrder()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            aria-label="Số thứ tự ghép Word"
          />
        </div>
      ) : null}
    </div>
  )
}

function ImageSection({
  title,
  urls,
  onOpen,
  selectedUrls,
  onToggle,
  onSelectAll,
  onClearAll,
  orderIndex,
  onOrderChange,
  onDeletePhoto,
  deletingUrl,
}: {
  title: string
  urls: string[]
  onOpen: (index: number) => void
  selectedUrls?: string[]
  onToggle?: (url: string) => void
  onSelectAll?: () => void
  onClearAll?: () => void
  orderIndex?: (url: string) => number | undefined
  onOrderChange?: (url: string, order: number) => void
  onDeletePhoto?: (url: string) => void
  deletingUrl?: string | null
}) {
  const selected = selectedUrls ?? []
  const allSelected = urls.length > 0 && urls.every((u) => selected.includes(u))
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">
          {title}
          {urls.length > 0 ? (
            <span className="ml-1.5 font-normal text-muted-foreground">({urls.length})</span>
          ) : null}
        </p>
        {onSelectAll && urls.length > 0 ? (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={allSelected ? onClearAll : onSelectAll}
            >
              {allSelected ? 'Bỏ chọn tất' : 'Chọn tất'}
            </Button>
            {selected.length > 0 ? (
              <span className="self-center text-xs text-muted-foreground">
                Đã chọn {selected.length}/{urls.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {urls.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có ảnh</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {urls.map((url, index) => (
            <ThumbnailTile
              key={url}
              url={url}
              index={index}
              title={title}
              onOpen={() => onOpen(index)}
              selected={selected.includes(url)}
              onSelect={onToggle ? () => onToggle(url) : undefined}
              mergeOrder={orderIndex?.(url)}
              onOrderChange={
                onOrderChange && selected.includes(url)
                  ? (order) => onOrderChange(url, order)
                  : undefined
              }
              onDelete={onDeletePhoto ? () => onDeletePhoto(url) : undefined}
              deleting={deletingUrl === url}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ImageLightbox({
  state,
  onClose,
  onIndexChange,
  selection,
}: {
  state: LightboxState
  onClose: () => void
  onIndexChange: (index: number) => void
  selection?: GallerySelection
}) {
  const { items, index } = state
  const item = items[index]
  const url = item?.url ?? ''
  const kind = item?.kind
  const title = item?.label ?? ''
  const selectedUrls = kind === 'before' ? selection?.beforeUrls : selection?.afterUrls
  const isSelected = selectedUrls?.includes(url) ?? false
  const canSelect = !!selection && !!kind
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + items.length) % items.length
      onIndexChange(next)
    },
    [index, onIndexChange, items.length],
  )

  useEffect(() => {
    setReady(false)
    setError(false)
  }, [url])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem ảnh — ${title}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-white sm:px-4">
        <p className="min-w-0 truncate text-sm font-medium">
          {title} · {index + 1}/{items.length}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-white hover:bg-white/15"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-12">
        {items.length > 1 ? (
          <button
            type="button"
            className="absolute left-1 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:left-3"
            onClick={() => go(-1)}
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        ) : null}

        <div className="flex max-h-full max-w-full items-center justify-center p-2">
          {!ready && !error ? (
            <div className="flex flex-col items-center gap-3 text-white/80">
              <Loader2 className="h-10 w-10 animate-spin" />
              <span className="text-sm">Đang tải…</span>
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-white/70">Không tải được ảnh</p>
          ) : (
            <img
              key={url}
              src={url}
              alt=""
              className={cn(
                'max-h-[calc(100dvh-8rem)] max-w-full object-contain transition-opacity duration-300 ease-out',
                ready ? 'opacity-100' : 'opacity-0',
              )}
              draggable={false}
              onLoad={() => setReady(true)}
              onError={() => setError(true)}
            />
          )}
        </div>

        {items.length > 1 ? (
          <button
            type="button"
            className="absolute right-1 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:right-3"
            onClick={() => go(1)}
            aria-label="Ảnh sau"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2 px-4 pb-4 pt-1 text-center">
        {canSelect ? (
          <Button
            type="button"
            size="sm"
            variant={isSelected ? 'secondary' : 'default'}
            className="gap-2"
            onClick={() => selection!.onToggle(kind!, url)}
            aria-pressed={isSelected}
          >
            {isSelected ? (
              <>
                <Check className="h-4 w-4" /> Đã chọn cho báo cáo Word
              </>
            ) : (
              <>
                <Star className="h-4 w-4" /> Chọn ảnh này cho báo cáo Word
              </>
            )}
          </Button>
        ) : null}
        <div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            Mở ảnh gốc trong tab mới
          </a>
        </div>
      </div>
    </div>
  )
}

type Props = {
  beforeUrls: string[]
  afterUrls: string[]
  beforeTitle?: string
  afterTitle?: string
  hideBefore?: boolean
  hideAfter?: boolean
  /** Bật chọn ảnh để ghép báo cáo Word (nhớ ảnh đã chọn). */
  selection?: GallerySelection
  /** Xóa từng ảnh (có hỏi xác nhận ở drawer). */
  onDeletePhoto?: (kind: SelectionKind, url: string) => void
  deletingUrl?: string | null
}

export function IncidentImageGallery({
  beforeUrls,
  afterUrls,
  beforeTitle = 'Trước thi công',
  afterTitle = 'Sau thi công',
  hideBefore = false,
  hideAfter = false,
  selection,
  onDeletePhoto,
  deletingUrl,
}: Props) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  // Danh sách GỘP cả Hiện trạng + Sau xử lý để xem ảnh vuốt liên tục, không phải
  // thoát ra mở nhóm khác. Chỉ gộp các nhóm đang hiển thị.
  const combinedItems: LightboxItem[] = [
    ...(!hideBefore
      ? beforeUrls.map((url) => ({
          url,
          kind: selection ? ('before' as SelectionKind) : undefined,
          label: beforeTitle,
        }))
      : []),
    ...(!hideAfter
      ? afterUrls.map((url) => ({
          url,
          kind: selection ? ('after' as SelectionKind) : undefined,
          label: afterTitle,
        }))
      : []),
  ]
  const afterOffset = hideBefore ? 0 : beforeUrls.length

  function openAt(index: number) {
    if (combinedItems.length === 0) return
    setLightbox({ items: combinedItems, index })
  }

  return (
    <>
      <div className="space-y-4">
        {!hideBefore ? (
          <ImageSection
            title={beforeTitle}
            urls={beforeUrls}
            onOpen={(index) => openAt(index)}
            selectedUrls={selection?.beforeUrls}
            onToggle={selection ? (url) => selection.onToggle('before', url) : undefined}
            onSelectAll={selection ? () => selection.onSelectAll('before') : undefined}
            onClearAll={selection ? () => selection.onClearAll('before') : undefined}
            orderIndex={
              selection?.orderIndex
                ? (url) => selection.orderIndex!('before', url)
                : undefined
            }
            onOrderChange={
              selection?.onOrderChange
                ? (url, order) => selection.onOrderChange!('before', url, order)
                : undefined
            }
            onDeletePhoto={onDeletePhoto ? (url) => onDeletePhoto('before', url) : undefined}
            deletingUrl={deletingUrl}
          />
        ) : null}
        {!hideAfter ? (
          <ImageSection
            title={afterTitle}
            urls={afterUrls}
            onOpen={(index) => openAt(afterOffset + index)}
            selectedUrls={selection?.afterUrls}
            onToggle={selection ? (url) => selection.onToggle('after', url) : undefined}
            onSelectAll={selection ? () => selection.onSelectAll('after') : undefined}
            onClearAll={selection ? () => selection.onClearAll('after') : undefined}
            orderIndex={
              selection?.orderIndex
                ? (url) => selection.orderIndex!('after', url)
                : undefined
            }
            onOrderChange={
              selection?.onOrderChange
                ? (url, order) => selection.onOrderChange!('after', url, order)
                : undefined
            }
            onDeletePhoto={onDeletePhoto ? (url) => onDeletePhoto('after', url) : undefined}
            deletingUrl={deletingUrl}
          />
        ) : null}
      </div>

      {lightbox ? (
        <ImageLightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) => setLightbox((s) => (s ? { ...s, index } : s))}
          selection={selection}
        />
      ) : null}
    </>
  )
}
