import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// Watermelon Morphing Button, adapted in place for the expandable FashMap identity.
export function MorphingButton({ symbol }: { symbol: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const nameId = useId()
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!isExpanded) return
    const onOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsExpanded(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setIsExpanded(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('click', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [isExpanded])

  return (
    <span ref={containerRef}>
      <span className="hidden h-12 items-center gap-2 px-4 sm:flex">
        <img src={symbol} width={96} height={96} alt="" className="size-8" />
        <span className="font-heading text-[24px] leading-none font-medium tracking-[-0.025em]">FashMap</span>
      </span>
      <motion.button
        ref={buttonRef}
        type="button"
        aria-label={isExpanded ? 'Collapse FashMap logo' : 'Expand FashMap logo'}
        aria-expanded={isExpanded}
        aria-controls={nameId}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="flex h-12 items-center rounded-full px-2 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:hidden"
      >
        <img src={symbol} width={96} height={96} alt="" className="size-8 shrink-0" />
        <motion.span
          id={nameId}
          aria-hidden={!isExpanded}
          initial={false}
          animate={{ width: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
          transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 24 }}
          className="overflow-hidden whitespace-nowrap"
        >
          <span className="pr-2 pl-2 font-heading text-[24px] leading-none font-medium tracking-[-0.025em]">FashMap</span>
        </motion.span>
      </motion.button>
    </span>
  )
}
