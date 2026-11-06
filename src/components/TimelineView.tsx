import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { DateSpan } from '@/components/DateSpan'
import { GarmentImage } from '@/components/GarmentImage'
import CarouselCards, { type CarouselHandle } from '@/components/kokonutui/carousel-cards'
import { byCentury, byDate, yearRange, type Garment } from '@/lib/data'
import { cn } from '@/lib/utils'

type Props = { garments: Garment[]; selectedId?: string; onSelect: (id: string) => void; panelOpen: boolean; onClearFilters?: () => void }

function Junction({ count, active, markerId, reducedMotion }: { count: number; active: boolean; markerId: string; reducedMotion: boolean }) {
  return (
    <div aria-hidden className="relative mt-2 h-10">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" fill="none" className="absolute -left-2 h-full w-[calc(100%+1rem)] overflow-visible">
        <path d="M0 10H100" stroke="currentColor" vectorEffect="non-scaling-stroke" className="text-zinc-200" />
        {Array.from({ length: count }, (_, i) => {
          const x = ((i + 0.5) / count) * 100
          const bend = x < 50 ? x + 4 : x > 50 ? x - 4 : x
          const branch = `M50 10H${bend}Q${x} 10 ${x} 23V40`
          return (
            <g key={i}>
              <path d={branch} stroke="currentColor" vectorEffect="non-scaling-stroke" className="text-zinc-200" />
              <motion.path
                initial={false}
                animate={{ d: active ? branch : 'M50 10H50Q50 10 50 10V10', opacity: active ? 1 : 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="text-primary"
              />
            </g>
          )
        })}
      </svg>
      <span className="absolute top-2.5 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="block size-1.5 rounded-full bg-zinc-400 ring-4 ring-background" />
        {active && (
          <motion.span
            layoutId={markerId}
            initial={false}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
            className="absolute -inset-0.5 rounded-full border-2 border-background bg-primary ring-1 ring-primary/30"
          />
        )}
      </span>
    </div>
  )
}

// One carousel stop per museum date range. Matching dates share a junction and branch to their photos.
export function TimelineView({ garments, selectedId, onSelect, panelOpen, onClearFilters }: Props) {
  const dates = useMemo(() => byDate(garments), [garments])
  const centuries = useMemo(() => byCentury(garments), [garments])
  const railRef = useRef<CarouselHandle>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const active = dates[activeIndex] ?? dates[0]
  const reducedMotion = !!useReducedMotion()
  const markerId = useId()

  useEffect(() => {
    const index = dates.findIndex((d) => d.garments.some((g) => g.id === selectedId))
    if (index >= 0) railRef.current?.goTo(index)
  }, [selectedId, dates])

  return (
    <div className={cn('absolute inset-0 flex flex-col overflow-y-auto bg-background pt-24 transition-[padding] duration-300 ease-out motion-reduce:transition-none', panelOpen && 'md:pr-(--panel-space)')}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 px-4 sm:px-8">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground tabular-nums">{garments.length}</span> {garments.length === 1 ? 'garment' : 'garments'}, oldest first
        </p>
        {centuries.length > 1 && (
          <nav aria-label="Jump to century" className="-mx-4 flex max-w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
            {centuries.map(({ century, garments }) => (
              <button
                key={century}
                type="button"
                aria-pressed={!!active && Math.floor(active.start / 100) * 100 === century}
                onClick={() => railRef.current?.goTo(dates.findIndex((d) => Math.floor(d.start / 100) * 100 === century))}
                className="flex shrink-0 items-baseline gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-black/5 transition-[background-color,color,scale] hover:bg-zinc-100 active:scale-95 aria-pressed:bg-foreground aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              >
                <span className="font-heading text-[15px] tabular-nums">{century}s</span>
                <span className="text-xs tabular-nums opacity-60">{garments.length}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {dates.length === 0 ? (
        <div className="mx-auto mt-16 max-w-sm px-4 text-center">
          <p className="font-heading text-2xl text-foreground">No garments match</p>
          <p className="mt-2 text-sm text-muted-foreground">Remove a filter to see more.</p>
          {onClearFilters && (
            <button type="button" onClick={onClearFilters} className="mt-5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition-[scale,background-color] hover:bg-zinc-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <CarouselCards ref={railRef} key={dates.map((d) => `${d.start}:${d.end}:${d.garments.length}`).join('|')} count={dates.length} onActiveChange={setActiveIndex}>
          {dates.map((date) => {
            const current = date === active
            return (
              <li
                key={`${date.start}:${date.end}`}
                data-date={`${date.start}:${date.end}`}
                aria-label={`${yearRange(date.garments[0])}, ${date.garments.length} ${date.garments.length === 1 ? 'garment' : 'garments'}`}
                aria-current={current || undefined}
                className="relative shrink-0 snap-center [--photo-card:min(15rem,30svh)]"
                style={{ width: `min(calc(var(--photo-card) * ${date.garments.length} + 1rem * ${date.garments.length - 1}), calc(100cqw - 3rem))` }}
              >
                <div className="flex h-14 flex-col items-center justify-end gap-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-heading text-[28px] leading-none text-foreground tabular-nums sm:text-[34px]">{yearRange(date.garments[0])}</h2>
                    <DateSpan garment={date.garments[0]} />
                  </div>
                  <p className="h-4 text-xs text-muted-foreground">{date.garments.length > 1 ? `${date.garments.length} garments, same museum date` : '\u00a0'}</p>
                </div>
                <Junction count={date.garments.length} active={current} markerId={markerId} reducedMotion={reducedMotion} />
                <ul className="flex gap-4">
                  {date.garments.map((g) => (
                    <li key={g.id} data-id={g.id} className="min-w-0 flex-1">
                      <button
                        type="button"
                        data-rail-link=""
                        onClick={() => onSelect(g.id)}
                        aria-label={`${g.title}, ${yearRange(g)}, ${g.place}`}
                        aria-current={g.id === selectedId || undefined}
                        className="group block w-full rounded-xl text-left outline-none"
                      >
                        <span className={cn(
                          'block h-[32svh] overflow-hidden rounded-xl bg-white ring-1 ring-black/5 transition-[box-shadow,opacity] duration-300 group-focus-visible:ring-2 group-focus-visible:ring-primary sm:h-[min(36svh,360px)] motion-reduce:transition-none',
                          g.id === selectedId && 'ring-2 ring-primary',
                        )}>
                          <GarmentImage garment={g} size="card" />
                        </span>
                        <span className="mt-3 line-clamp-2 block min-h-[2.75em] font-heading text-[15px] leading-snug text-foreground decoration-primary/30 underline-offset-4 group-hover:underline sm:text-[18px]">{g.title}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground sm:text-[13px]">{g.place}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </CarouselCards>
      )}
    </div>
  )
}
