import NumberFlow from '@number-flow/react'
import { Slider } from '@/components/ui/slider'
import { inPeriod as overlaps, MAX_YEAR, MIN_YEAR, type Garment, type Period } from '@/lib/data'
import { cn } from '@/lib/utils'

const CENTURIES = [1500, 1600, 1700, 1800, 1900, 2000]
const pct = (year: number) => ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100
const YEAR = { useGrouping: false } as const

type Props = {
  period: Period
  onChange: (p: Period) => void
  garments: Garment[]
  total: number
  panelOpen: boolean
}

export function Timeline({ period, onChange, garments, total, panelOpen }: Props) {
  const [from, to] = period
  const changed = from !== MIN_YEAR || to !== MAX_YEAR
  const shown = garments.filter((g) => overlaps(g, period)).length

  return (
    <section
      aria-label="Period"
      className={cn(
        'absolute bottom-4 left-4 z-[1000] rounded-[22px] bg-white/88 px-5 pt-4 pb-3 shadow-float ring-1 ring-black/5 backdrop-blur-md transition-[width] duration-300 ease-out sm:px-6',
        panelOpen ? 'w-[min(720px,calc(100%-2rem))] md:w-[min(720px,calc(100%-2rem-470px))]' : 'w-[min(720px,calc(100%-2rem))]',
      )}
    >
      <div className="flex items-end justify-between gap-6">
        <p className="font-heading text-[28px] leading-none tracking-[-0.01em] whitespace-nowrap text-foreground tabular-nums sm:text-[34px]">
          <NumberFlow value={from} format={YEAR} />
          <span className="px-1.5 text-foreground/35">–</span>
          <NumberFlow value={to} format={YEAR} />
        </p>
        <p className="flex items-center gap-2 pb-0.5 text-right text-[13px] text-muted-foreground sm:gap-3 sm:text-sm" aria-live="polite">
          {shown === 0 ? (
            <span>No garments from this period. Widen the range.</span>
          ) : (
            <span>
              <NumberFlow value={shown} className="font-medium text-foreground tabular-nums" /> of {total} garments
            </span>
          )}
          {changed && (
            <button
              type="button"
              onClick={() => onChange([MIN_YEAR, MAX_YEAR])}
              className="rounded-full px-2.5 py-1 text-[13px] font-medium text-primary transition-[background-color,scale] hover:bg-primary/8 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary"
            >
              Reset
            </button>
          )}
        </p>
      </div>

      <Slider
        className="mt-5"
        min={MIN_YEAR}
        max={MAX_YEAR}
        step={5}
        minStepsBetweenThumbs={1}
        value={period}
        onValueChange={(v) => onChange([v[0], v[1]])}
        thumbLabels={['From year', 'To year']}
      />

      {/* mx matches half the thumb width, so the ticks line up with the thumb centres */}
      <div className="relative mx-[9px] mt-2 h-5" aria-hidden>
        {CENTURIES.map((y) => (
          <span key={y} className="absolute top-0 -translate-x-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ left: `${pct(y)}%` }}>
            <span className="mx-auto mb-0.5 block h-1 w-px bg-foreground/20" />
            {y}
          </span>
        ))}
      </div>
    </section>
  )
}
