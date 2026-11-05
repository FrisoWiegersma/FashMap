import { Check, SlidersHorizontal, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { applyFilters, filterCount, NO_FILTERS, options, type Filters as FilterState, type Garment } from '@/lib/data'
import { cn } from '@/lib/utils'

// Pattern from Watermelon `filter-disclosure` (a pill that morphs into a panel). That component is single-select
// with react-icons, so this is a multi-select version with two groups and lucide icons.

type Props = { garments: Garment[]; value: FilterState; onChange: (f: FilterState) => void; shown: number }

const MORPH = { type: 'spring', bounce: 0.18, duration: 0.5 } as const

export function Filters({ garments, value, onChange, shown }: Props) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLButtonElement>(null)
  const active = filterCount(value)

  // Counts follow the other group's choice, so a number always says what you get when you add that option.
  const types = options(applyFilters(garments, { ...value, types: [] }), 'type')
  const museums = options(applyFilters(garments, { ...value, museums: [] }), 'museum')
  const allTypes = options(garments, 'type').map((o) => ({ ...o, count: types.find((t) => t.value === o.value)?.count ?? 0 }))
  const allMuseums = options(garments, 'museum').map((o) => ({ ...o, count: museums.find((m) => m.value === o.value)?.count ?? 0 }))

  const toggle = (key: 'types' | 'museums', v: string) =>
    onChange({ ...value, [key]: value[key].includes(v) ? value[key].filter((x) => x !== v) : [...value[key], v] })

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => pillRef.current?.focus({ preventScroll: true }))
  }

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus({ preventScroll: true })
    const onDown = (e: PointerEvent) => !panelRef.current?.contains(e.target as Node) && setOpen(false)
    // Capture phase, so Esc closes the filters first and doesn't also close the garment or place behind them.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div className="relative">
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <motion.div
            key="panel"
            ref={panelRef}
            layoutId="filters"
            role="dialog"
            aria-modal="false"
            aria-label="Filters"
            tabIndex={-1}
            transition={MORPH}
            style={{ borderRadius: 18 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="fixed inset-x-4 top-4 z-10 flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden bg-white shadow-float ring-1 ring-black/5 outline-none md:absolute md:inset-x-auto md:top-0 md:left-0 md:max-h-[calc(100svh-15rem)] md:w-[360px]"
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.2 }} className="flex min-h-0 flex-col">
              <div className="flex items-center gap-2 border-b border-border py-2.5 pr-2.5 pl-5">
                <h2 className="flex-1 text-sm font-medium text-foreground">Filters</h2>
                {active > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(NO_FILTERS)
                      panelRef.current?.focus() // the button disappears, so keep focus in the panel
                    }}
                    className="rounded-full px-2.5 py-1 text-[13px] font-medium text-primary transition-colors hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close filters"
                  className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-5">
                <fieldset>
                  <legend className="text-[13px] text-muted-foreground">Type</legend>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {allTypes.map((o, i) => {
                      const on = value.types.includes(o.value)
                      return (
                        <motion.button
                          key={o.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle('types', o.value)}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.12 + i * 0.025, duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] capitalize transition-[background-color,border-color,color,scale] duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                            on ? 'border-foreground bg-foreground text-white' : 'border-border bg-white text-foreground hover:border-zinc-300 hover:bg-muted',
                            !on && o.count === 0 && 'text-muted-foreground',
                          )}
                        >
                          <span className={cn('grid overflow-hidden transition-[width,opacity] duration-200', on ? 'w-3.5 opacity-100' : 'w-0 opacity-0')} aria-hidden>
                            <Check className="size-3.5" strokeWidth={2.5} />
                          </span>
                          {o.value}
                          <span className={cn('tabular-nums', on ? 'text-white/60' : 'text-muted-foreground')}>{o.count}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                </fieldset>

                <fieldset className="mt-5">
                  <legend className="text-[13px] text-muted-foreground">Museum</legend>
                  <div className="mt-1.5 -mx-2">
                    {allMuseums.map((o, i) => {
                      const on = value.museums.includes(o.value)
                      return (
                        <motion.label
                          key={o.value}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.18 + i * 0.03, duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                        >
                          <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle('museums', o.value)} />
                          <span
                            className={cn(
                              'grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-[background-color,border-color] duration-150',
                              on ? 'border-foreground bg-foreground text-white' : 'border-zinc-300 bg-white',
                            )}
                            aria-hidden
                          >
                            <Check className={cn('size-3 transition-[opacity,scale] duration-150', on ? 'scale-100 opacity-100' : 'scale-50 opacity-0')} strokeWidth={3} />
                          </span>
                          <span className={cn('flex-1 text-sm', o.count === 0 && !on ? 'text-muted-foreground' : 'text-foreground')}>{o.value}</span>
                          <span className="text-[13px] text-muted-foreground tabular-nums">{o.count}</span>
                        </motion.label>
                      )
                    })}
                  </div>
                </fieldset>
              </div>

              <p className="border-t border-border bg-muted/50 px-5 py-3 text-[13px] text-muted-foreground" aria-live="polite">
                {shown === 0 ? 'No garments match. Remove a filter to see more.' : `Showing ${shown} of ${garments.length} garments`}
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.button
            key="pill"
            ref={pillRef}
            layoutId="filters"
            type="button"
            aria-expanded={false}
            aria-label={active ? `Filters, ${active} active` : 'Filters'}
            onClick={() => setOpen(true)}
            transition={MORPH}
            style={{ borderRadius: 24 }}
            whileTap={{ scale: 0.96 }}
            className="flex h-12 items-center gap-2 bg-white/85 px-4 text-sm font-medium text-foreground shadow-float ring-1 ring-black/5 backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <SlidersHorizontal className="size-4" />
            <span className="max-sm:sr-only">Filters</span>
            <AnimatePresence initial={false}>
              {active > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white tabular-nums"
                  aria-hidden
                >
                  {active}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
