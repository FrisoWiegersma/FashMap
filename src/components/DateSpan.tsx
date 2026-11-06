import type { Garment } from '@/lib/data'
import { cn } from '@/lib/utils'

/**
 * How exact a garment's date is: a segment on a 100-year track. Narrow for an exact year, wide for "19th century".
 * A vague date counts in every period it touches, so this shows the uncertainty instead of hiding it.
 */
export function DateSpan({ garment, className }: { garment: Garment; className?: string }) {
  const years = garment.end - garment.start + 1
  const label = years === 1 ? 'Exact year' : `Dated to a ${years}-year range`
  return (
    <span role="img" aria-label={label} title={label} className={cn('relative inline-block h-1 w-10 shrink-0 rounded-full bg-zinc-200', className)}>
      <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(8, years))}%` }} />
    </span>
  )
}
