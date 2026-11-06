import { useEffect, useMemo, useRef } from 'react'
import { DateSpan } from '@/components/DateSpan'
import { GarmentImage } from '@/components/GarmentImage'
import { byCentury, yearRange, type Garment } from '@/lib/data'
import { cn } from '@/lib/utils'

type Props = { garments: Garment[]; selectedId?: string; onSelect: (id: string) => void; panelOpen: boolean; onClearFilters?: () => void }

const sectionId = (century: number) => `fm-century-${century}`

// The garments in date order, grouped by century (roadmap F13). From 640 px it is one horizontal rail with the axis
// along the top; on a phone it runs down the page with the axis on the left, because phones scroll vertically.
// ponytail: ordered, not to scale. Most garments are from after 1850, so a true axis would be mostly empty space.
export function TimelineView({ garments, selectedId, onSelect, panelOpen, onClearFilters }: Props) {
  const centuries = useMemo(() => byCentury(garments), [garments])
  const railRef = useRef<HTMLDivElement>(null)

  // Keep the open garment's card in view, next to the panel rather than under it.
  useEffect(() => {
    if (selectedId) railRef.current?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [selectedId])

  const jump = (century: number) => document.getElementById(sectionId(century))?.scrollIntoView({ inline: 'start', block: 'start' })

  return (
    <div className="absolute inset-0 flex flex-col bg-background pt-24">
      <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 px-4 transition-[padding] duration-300 ease-out sm:px-8', panelOpen && 'md:pr-[470px]')}>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground tabular-nums">{garments.length}</span> {garments.length === 1 ? 'garment' : 'garments'}, oldest first
        </p>
        {centuries.length > 1 && (
          <nav aria-label="Jump to century" className="-mx-4 flex max-w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
            {centuries.map(({ century, garments }) => (
              <button
                key={century}
                type="button"
                onClick={() => jump(century)}
                className="flex shrink-0 items-baseline gap-1.5 rounded-full bg-white px-3 py-1 ring-1 ring-black/5 transition-[background-color,scale] hover:bg-zinc-50 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="font-heading text-[15px] text-foreground tabular-nums">{century}s</span>
                <span className="text-xs text-muted-foreground tabular-nums">{garments.length}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {garments.length === 0 ? (
        <div className="mx-auto mt-16 max-w-sm px-4 text-center">
          <p className="font-heading text-2xl text-foreground">No garments match</p>
          <p className="mt-2 text-sm text-muted-foreground">Remove a filter to see more.</p>
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition-[scale,background-color] hover:bg-zinc-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          ref={railRef}
          aria-label="Garments by date"
          role="region"
          // A mouse wheel only scrolls vertically, so on the horizontal rail turn it sideways. Trackpads and touch already scroll sideways.
          onWheel={(e) => {
            const el = e.currentTarget
            if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollBy({ left: e.deltaY * (e.deltaMode === 1 ? 40 : 1), behavior: 'instant' })
          }}
          className={cn(
            'mt-3 min-h-0 flex-1 overflow-y-auto scroll-smooth motion-reduce:scroll-auto sm:mt-0 sm:flex sm:flex-col sm:justify-center sm:overflow-x-auto sm:overflow-y-hidden sm:scroll-pl-8',
            panelOpen && 'md:scroll-pr-[470px]',
          )}
        >
          <div className="flex flex-col gap-6 px-4 pb-10 sm:w-max sm:flex-row sm:gap-5 sm:px-8 sm:pb-6">
            {centuries.map(({ century, garments }) => (
              <section key={century} id={sectionId(century)} aria-labelledby={`${sectionId(century)}-h`} className="shrink-0">
                {/* Sticks to the top (phone) or the left edge (wider) while its century scrolls past. */}
                <header className="sticky top-0 left-8 z-10 flex items-baseline gap-2 bg-background/90 py-2.5 backdrop-blur-md sm:w-fit sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
                  <h2 id={`${sectionId(century)}-h`} className="font-heading text-[26px] leading-none tracking-[-0.01em] text-foreground tabular-nums sm:text-[30px]">
                    {century}s
                  </h2>
                  <span className="text-[13px] text-muted-foreground">
                    {garments.length} {garments.length === 1 ? 'garment' : 'garments'}
                  </span>
                </header>
                <ol className="mt-2 flex flex-col gap-4 sm:mt-5 sm:flex-row sm:gap-5">
                  {garments.map((g) => {
                    const selected = g.id === selectedId
                    const dot = (className: string) => (
                      <span
                        className={cn(
                          'absolute top-1/2 rounded-full ring-4 ring-background transition-[background-color] duration-200',
                          selected ? 'size-2.5 bg-primary' : 'size-2 bg-zinc-400 group-hover:bg-zinc-600',
                          className,
                        )}
                      />
                    )
                    return (
                      <li key={g.id} data-id={g.id} className="sm:w-[min(260px,30svh,42vw)] sm:shrink-0">
                        {/* Phone: photo left, text right. Wider: one column, where `sm:contents` and `order` put the year and the axis above the photo. */}
                        <button
                          type="button"
                          onClick={() => onSelect(g.id)}
                          aria-current={selected || undefined}
                          className="group relative flex w-full items-center gap-4 pl-7 text-left outline-none sm:flex-col sm:items-stretch sm:gap-0 sm:pl-0"
                        >
                          {/* Phone axis: down the left edge, through the gap to the next card. */}
                          <span aria-hidden className="absolute top-0 -bottom-4 left-[4.5px] w-px bg-zinc-200 sm:hidden" />
                          {dot('left-[5px] -translate-x-1/2 -translate-y-1/2 sm:hidden')}
                          {/* Wider axis: along the top, half a gap past each side so the line runs unbroken. */}
                          <span aria-hidden className="relative my-3 hidden h-2.5 sm:order-[-1] sm:block">
                            <span className="absolute top-1/2 -right-2.5 -left-2.5 h-px bg-zinc-200" />
                            {dot('left-0 -translate-y-1/2')}
                          </span>
                          {/* Phone: the whole photo at its own shape in a fixed slot, framed tight, so rows line up without blurred fill. */}
                          <span className="flex h-32 w-24 shrink-0 items-center justify-center sm:hidden">
                            <GarmentImage
                              garment={g}
                              size="fit"
                              className={cn(
                                'rounded-xl ring-1 ring-black/5 transition-[box-shadow,scale] duration-200 group-focus-visible:ring-2 group-focus-visible:ring-primary group-active:scale-[0.98]',
                                selected && 'ring-2 ring-primary',
                              )}
                            />
                          </span>
                          {/* Wider: equal 4:5 cards along the rail, like the grid. */}
                          <span
                            className={cn(
                              'block aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-black/5 transition-[box-shadow,scale] duration-200 group-focus-visible:ring-2 group-focus-visible:ring-primary group-active:scale-[0.98] max-sm:hidden',
                              selected && 'ring-2 ring-primary',
                            )}
                          >
                            <span className="block size-full transition-transform duration-700 ease-out group-hover:scale-[1.04]">
                              <GarmentImage garment={g} size="card" />
                            </span>
                          </span>
                          <span className="flex min-w-0 flex-col sm:contents">
                            <span className="flex items-center gap-2.5 sm:order-[-2]">
                              <span className={cn('font-heading text-[15px] leading-none tabular-nums sm:text-[17px]', selected ? 'text-primary' : 'text-foreground')}>{yearRange(g)}</span>
                              <DateSpan garment={g} />
                            </span>
                            <span className="mt-2 line-clamp-2 block font-heading text-[17px] leading-snug text-foreground decoration-primary/30 underline-offset-4 group-hover:underline sm:mt-3">
                              {g.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{g.place}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
