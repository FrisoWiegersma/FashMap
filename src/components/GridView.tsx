import { AnimatePresence, motion } from 'motion/react'
import { GarmentImage } from '@/components/GarmentImage'
import type { Garment } from '@/lib/data'
import { cn } from '@/lib/utils'

type Props = { garments: Garment[]; selectedId?: string; onSelect: (id: string) => void; panelOpen: boolean; onClearFilters?: () => void }

// Baseline condition for the evaluation: a plain Modemuze-style photo grid.
// Place and date appear only as text, with no map, timeline or 3D (see roadmap F6).
export function GridView({ garments, selectedId, onSelect, panelOpen, onClearFilters }: Props) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-background">
      <div className={cn('mx-auto max-w-[1400px] px-4 pt-24 pb-10 transition-[padding] duration-300 ease-out sm:px-8', panelOpen && 'md:pr-(--panel-space)')}>
        <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground tabular-nums">{garments.length}</span> {garments.length === 1 ? 'garment' : 'garments'}
        </p>
        {garments.length === 0 && (
          <div className="mx-auto mt-16 max-w-sm text-center">
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
        )}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-x-5 sm:gap-y-9">
          <AnimatePresence initial={false} mode="popLayout">
            {garments.map((g) => (
              <motion.li
                key={g.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              >
                <button type="button" onClick={() => onSelect(g.id)} aria-current={g.id === selectedId || undefined} className="group block w-full text-left outline-none">
                  <span
                    className={cn(
                      'block aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-black/5 transition-[box-shadow,scale] duration-200 group-focus-visible:ring-2 group-focus-visible:ring-primary group-active:scale-[0.98]',
                      g.id === selectedId && 'ring-2 ring-primary',
                    )}
                  >
                    <span className="block size-full transition-transform duration-700 ease-out group-hover:scale-[1.04]">
                      <GarmentImage garment={g} size="card" />
                    </span>
                  </span>
                  <span className="mt-3 block font-heading text-[17px] leading-snug text-foreground decoration-primary/30 underline-offset-4 group-hover:underline">{g.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {g.dateLabel}, {g.place}
                  </span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  )
}
