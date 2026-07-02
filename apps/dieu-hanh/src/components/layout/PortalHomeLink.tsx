import { cn } from '@/lib/utils'

/** Khớp nhật ký tuần đường — `/san-pham` trên Vercel. */
export const PORTAL_HOME_URL = '/san-pham'

type PortalHomeLinkProps = {
  className?: string
  /** Nút vuông gọn (sidebar) hoặc dạng thanh nav (full height). */
  variant?: 'square' | 'nav'
}

export function PortalHomeLink({ className, variant = 'square' }: PortalHomeLinkProps) {
  return (
    <a
      href={PORTAL_HOME_URL}
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-white no-underline transition',
        'bg-[#0066b3] hover:bg-[#0a7fd4] hover:-translate-y-0.5',
        variant === 'nav'
          ? 'min-w-[52px] border-r border-white/20 px-[18px] py-0 hover:translate-y-0'
          : 'h-11 w-11 rounded-lg',
        className,
      )}
      title="Trang chủ"
      aria-label="Trang chủ"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-[22px] w-[22px] fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M10 20v-6h4v6" />
      </svg>
    </a>
  )
}
