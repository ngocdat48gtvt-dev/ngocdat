import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'

type LightboxState = {
  title: string
  urls: string[]
  index: number
}

function ThumbnailTile({
  url,
  index,
  title,
  onOpen,
}: {
  url: string
  index: number
  title: string
  onOpen: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex w-[140px] shrink-0 flex-col overflow-hidden rounded-xl border border-border',
        'bg-muted/40 shadow-sm transition hover:border-primary/40 hover:shadow-md',
        'sm:w-[168px]',
      )}
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
  )
}

function ImageSection({
  title,
  urls,
  onOpen,
}: {
  title: string
  urls: string[]
  onOpen: (index: number) => void
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">
        {title}
        {urls.length > 0 ? (
          <span className="ml-1.5 font-normal text-muted-foreground">({urls.length})</span>
        ) : null}
      </p>
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
}: {
  state: LightboxState
  onClose: () => void
  onIndexChange: (index: number) => void
}) {
  const { urls, index, title } = state
  const url = urls[index]
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + urls.length) % urls.length
      onIndexChange(next)
    },
    [index, onIndexChange, urls.length],
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
          {title} · {index + 1}/{urls.length}
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
        {urls.length > 1 ? (
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

        {urls.length > 1 ? (
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

      <div className="shrink-0 px-4 pb-4 pt-1 text-center">
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
  )
}

type Props = {
  beforeUrls: string[]
  afterUrls: string[]
}

export function IncidentImageGallery({ beforeUrls, afterUrls }: Props) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  function openSection(title: string, urls: string[], index: number) {
    setLightbox({ title, urls, index })
  }

  return (
    <>
      <div className="space-y-4">
        <ImageSection
          title="Trước thi công"
          urls={beforeUrls}
          onOpen={(index) => openSection('Trước thi công', beforeUrls, index)}
        />
        <ImageSection
          title="Sau thi công"
          urls={afterUrls}
          onOpen={(index) => openSection('Sau thi công', afterUrls, index)}
        />
      </div>

      {lightbox ? (
        <ImageLightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) => setLightbox((s) => (s ? { ...s, index } : s))}
        />
      ) : null}
    </>
  )
}
