import NumberFlow from '@number-flow/react'
import { Pause, Play } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { histogram, inPeriod as overlaps, MAX_YEAR, MIN_YEAR, shiftWindow, yearPct, yearRange, type Garment, type Period } from '@/lib/data'
import { log } from '@/lib/log'
import { cn } from '@/lib/utils'

const CENTURIES = [1500, 1600, 1700, 1800, 1900, 2000]
const YEAR = { useGrouping: false } as const
const PLAY_SPEED = 25 // years per second: 1500 to now in about 19 s
const PLAY_WIDTH = 50 // years, when the whole range is selected

type Props = {
  period: Period
  onChange: (p: Period) => void
  garments: Garment[] // after filters
  total: number
  panelOpen: boolean
  garment: Garment | null // the open garment, drawn as a band over its years
}

export function Timeline({ period, onChange, garments, total, panelOpen, garment }: Props) {
  const [from, to] = period
  const changed = from !== MIN_YEAR || to !== MAX_YEAR
  const shown = garments.filter((g) => overlaps(g, period)).length
  const bins = useMemo(() => histogram(garments), [garments])
  const peak = Math.max(1, ...bins.map((b) => b.count))

  // Play through time: the window glides forward by the clock, one year at a time, so the thumbs and dots move
  // continuously instead of jumping. `play` is the window it started from.
  const [play, setPlay] = useState<Period | null>(null)
  useEffect(() => {
    if (!play) return
    const t0 = performance.now()
    // One tick per year; the position comes from the clock, so a throttled timer never slows the playback down.
    const id = setInterval(() => {
      const next = shiftWindow(play, ((performance.now() - t0) / 1000) * PLAY_SPEED)
      onChange(next)
      if (next[1] < MAX_YEAR) return
      clearInterval(id)
      setPlay(null)
      log('period_play', { playing: false, from: next[0], to: next[1] })
    }, 1000 / PLAY_SPEED)
    return () => clearInterval(id)
  }, [play, onChange])

  const stop = () => {
    if (!play) return
    setPlay(null)
    log('period_play', { playing: false, from, to })
  }
  const togglePlay = () => {
    if (play) return stop()
    // Resume a narrowed window where it is; otherwise start at 1500 with the same width, or 50 years.
    const start: Period = changed && to < MAX_YEAR ? period : [MIN_YEAR, MIN_YEAR + (changed ? to - from : PLAY_WIDTH)]
    onChange(start)
    setPlay(start)
    log('period_play', { playing: true, from: start[0], to: start[1] })
  }

  const band = garment && { left: yearPct(garment.start), right: yearPct(Math.min(garment.end + 1, MAX_YEAR)) }

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
          {/* No roll while playing: a new year every 40 ms would keep the digits mid-spin. */}
          <NumberFlow value={from} format={YEAR} animated={!play} />
          <span className="px-1.5 text-foreground/35">–</span>
          <NumberFlow value={to} format={YEAR} animated={!play} />
        </p>
        <p className="flex items-center gap-2 pb-0.5 text-right text-[13px] text-muted-foreground sm:gap-3 sm:text-sm" aria-live={play ? 'off' : 'polite'}>
          {shown === 0 ? (
            <span>{garments.length ? 'No garments from this period. Widen the range.' : 'No garments match the filters.'}</span>
          ) : (
            <span>
              <NumberFlow value={shown} animated={!play} className="font-medium text-foreground tabular-nums" />
              <span className="max-sm:hidden"> of {total}</span> garments
            </span>
          )}
          {changed && (
            <button
              type="button"
              onClick={() => {
                stop()
                onChange([MIN_YEAR, MAX_YEAR])
              }}
              className="rounded-full px-2.5 py-1 text-[13px] font-medium text-primary transition-[background-color,scale] hover:bg-primary/8 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary"
            >
              Reset
            </button>
          )}
        </p>
      </div>

      <div className="mt-4 flex gap-3 sm:gap-4">
        {/* Play sits on the slider's line, like a media player's scrubber: bars (36) + gap (6) + half the slider (10) - half the button (18). */}
        <div className="shrink-0 pt-[34px]">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={play ? 'Pause' : 'Play through time'}
            title={play ? 'Pause' : 'Play through time'}
            className="grid size-9 place-items-center rounded-full bg-primary text-white shadow-[0_1px_2px_rgb(0_0_0/0.1),0_6px_16px_-6px_rgb(45_91_255/0.7)] ring-1 ring-black/5 transition-[scale,box-shadow] duration-200 ease-out hover:scale-[1.06] hover:shadow-[0_1px_2px_rgb(0_0_0/0.1),0_8px_20px_-6px_rgb(45_91_255/0.8)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={play ? 'pause' : 'play'}
                initial={{ scale: 0.4, opacity: 0, filter: 'blur(3px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                exit={{ scale: 0.4, opacity: 0, filter: 'blur(3px)' }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                className="grid place-items-center"
              >
                {play ? <Pause className="size-3.5 fill-current" strokeWidth={0} /> : <Play className="size-3.5 translate-x-px fill-current" strokeWidth={0} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative">
            {/* The open garment's years, behind the bars and the slider, so you see where it sits in the period. */}
            {band && (
              <div className="pointer-events-none absolute inset-x-[9px] -top-1.5 bottom-0">
                <span
                  className="absolute inset-y-0 rounded-[4px] bg-primary/12 ring-1 ring-primary/40"
                  style={{ left: `${band.left}%`, width: `max(3px, ${band.right - band.left}%)` }}
                />
                <span
                  className={cn(
                    'absolute -top-2.5 z-10 rounded-full bg-white px-2 py-0.5 font-heading text-[12px] leading-tight whitespace-nowrap text-primary tabular-nums shadow-sm ring-1 ring-primary/30',
                    band.left < 8 ? '' : band.right > 92 ? '-translate-x-full' : '-translate-x-1/2',
                  )}
                  style={{ left: `${band.left < 8 ? band.left : band.right > 92 ? band.right : (band.left + band.right) / 2}%` }}
                >
                  <span className="sr-only">Open garment, </span>
                  {yearRange(garment)}
                </span>
              </div>
            )}

            {/* Garments per 25 years, so empty stretches show before you drag into them. Bars in the period are cobalt, the rest pale grey. */}
            <div className="relative mx-[9px] h-9" aria-hidden>
              {bins.map((b) => {
                const live = b.to >= from && b.from <= to
                return (
                  <span
                    key={b.from}
                    className="absolute bottom-0 px-px"
                    style={{ left: `${yearPct(b.from)}%`, width: `${yearPct(Math.min(b.to + 1, MAX_YEAR)) - yearPct(b.from)}%`, height: '100%' }}
                  >
                    <span
                      className={cn(
                        'absolute inset-x-px bottom-0 rounded-t-[3px] transition-[height,background-color] duration-300 ease-out',
                        live ? 'bg-primary/85' : 'bg-zinc-300/70',
                      )}
                      style={{ height: b.count ? `${Math.max(8, (b.count / peak) * 100)}%` : '2px' }}
                    />
                  </span>
                )
              })}
            </div>

            <Slider
              className="mt-1.5"
              min={MIN_YEAR}
              max={MAX_YEAR}
              step={5}
              minStepsBetweenThumbs={1}
              value={period}
              onValueChange={(v) => {
                stop()
                onChange([v[0], v[1]])
              }}
              thumbLabels={['From year', 'To year']}
            />
          </div>

          {/* mx matches half the thumb width, so the ticks line up with the thumb centres */}
          <div className="relative mx-[9px] mt-2 h-5" aria-hidden>
            {CENTURIES.map((y) => (
              <span key={y} className="absolute top-0 -translate-x-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ left: `${yearPct(y)}%` }}>
                <span className="mx-auto mb-0.5 block h-1 w-px bg-foreground/20" />
                {y}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
