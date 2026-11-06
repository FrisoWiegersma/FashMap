// Kokonut UI Momentum Rail (MIT, Dorian Baffier), adapted for FashMap date groups.
// Keeps its mouse flick, spring snapping, native touch scrolling and keyboard navigation.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'

export type CarouselHandle = { goTo: (index: number) => void }

const STIFFNESS = 170;
const DAMPING = 26; // about 2·√170: critically damped, so no bounce at the card
const DECELERATION = 0.997; // UIScrollView's normal rate, per ms
const DRAG_THRESHOLD = 4;

const rubber = (overshoot: number, size: number) =>
  Math.sign(overshoot) *
  (1 - 1 / ((Math.abs(overshoot) * 0.55) / size + 1)) *
  size;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

interface RailState {
  mode: "idle" | "pressing" | "dragging" | "spring";
  pointerId: number;
  startX: number;
  startPos: number;
  pos: number;
  vel: number;
  target: number;
  samples: { t: number; x: number }[];
  raf: number;
  last: number;
  suppressClick: boolean;
  /** The press caught a moving rail, so letting go must settle it. */
  caught: boolean;
}

const maxScroll = (scroller: HTMLElement) =>
  scroller.scrollWidth - scroller.clientWidth;

const snapPoints = (scroller: HTMLElement, track: HTMLUListElement) => {
  const max = maxScroll(scroller);
  return Array.from(track.children, (child) => {
    const card = child as HTMLElement;
    const center = track.offsetLeft + card.offsetLeft + card.offsetWidth / 2;
    return clamp(center - scroller.clientWidth / 2, 0, max);
  });
};

const nearestIndex = (points: number[], pos: number) => {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i] - pos) < Math.abs(points[best] - pos)) {
      best = i;
    }
  }
  return best;
};

// Release velocity in px/ms from the last 100ms of samples; a pause before
// letting go means no flick.
const releaseVelocity = (samples: RailState["samples"], now: number) => {
  const first = samples[0];
  const last = samples.at(-1) ?? first;
  const dt = last.t - first.t;
  if (dt <= 0 || now - last.t > 60) {
    return 0;
  }
  return -(last.x - first.x) / dt;
};

function useMomentumRail(
  scrollerRef: RefObject<HTMLElement | null>,
  trackRef: RefObject<HTMLUListElement | null>,
  onIndex: (index: number) => void
) {
  const state = useRef<RailState>({
    mode: "idle",
    pointerId: -1,
    startX: 0,
    startPos: 0,
    pos: 0,
    vel: 0,
    target: 0,
    samples: [],
    raf: 0,
    last: 0,
    suppressClick: false,
    caught: false,
  });
  const onIndexRef = useRef(onIndex);
  const scrollRaf = useRef(0);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { onIndexRef.current = onIndex; }, [onIndex]);

  // Write a virtual position: the in-range part scrolls natively, the rest
  // becomes a damped translate on the track (the rubber band).
  const apply = useCallback(
    (pos: number) => {
      const scroller = scrollerRef.current;
      const track = trackRef.current;
      if (!(scroller && track)) {
        return;
      }
      const inRange = clamp(pos, 0, maxScroll(scroller));
      scroller.scrollLeft = inRange;
      const over = pos - inRange;
      track.style.transform =
        Math.abs(over) > 0.1
          ? `translate3d(${(-rubber(over, scroller.clientWidth)).toFixed(2)}px,0,0)`
          : "";
    },
    [scrollerRef, trackRef]
  );

  // Native scroll snap is off while JS owns the position.
  const setFree = useCallback(
    (free: boolean) => {
      const scroller = scrollerRef.current;
      if (scroller) {
        scroller.dataset.free = String(free);
      }
    },
    [scrollerRef]
  );

  const step = useCallback(
    function tick(now: number) {
      const s = state.current;
      const dt = Math.min((now - s.last) / 1000, 1 / 30);
      s.last = now;
      // Semi-implicit Euler substeps keep the spring stable at any frame rate.
      const h = dt / 4;
      for (let i = 0; i < 4; i++) {
        const accel = -STIFFNESS * (s.pos - s.target) - DAMPING * s.vel;
        s.vel += accel * h;
        s.pos += s.vel * h;
      }
      if (Math.abs(s.pos - s.target) < 0.5 && Math.abs(s.vel) < 8) {
        s.pos = s.target;
        s.vel = 0;
        s.mode = "idle";
        apply(s.target);
        setFree(false);
        return;
      }
      apply(s.pos);
      s.raf = requestAnimationFrame(tick);
    },
    [apply, setFree]
  );

  const springTo = useCallback(
    (target: number, velocity: number) => {
      const s = state.current;
      const scroller = scrollerRef.current;
      if (!scroller) {
        return;
      }
      cancelAnimationFrame(s.raf);
      // A spring, drag or caught press carries its own virtual position,
      // overshoot included.
      if (s.mode === "idle") {
        s.pos = scroller.scrollLeft;
      }
      s.target = target;
      s.vel = velocity;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        s.mode = "idle";
        s.pos = target;
        apply(target);
        setFree(false);
        return;
      }
      s.mode = "spring";
      setFree(true);
      s.last = performance.now();
      s.raf = requestAnimationFrame(step);
    },
    [apply, scrollerRef, setFree, step]
  );

  const goTo = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      const track = trackRef.current;
      if (!(scroller && track)) {
        return;
      }
      const s = state.current;
      const points = snapPoints(scroller, track);
      const i = clamp(index, 0, points.length - 1);
      springTo(points[i], s.mode === "spring" ? s.vel : 0);
    },
    [scrollerRef, springTo, trackRef]
  );

  const currentIndex = useCallback(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!(scroller && track)) {
      return 0;
    }
    const s = state.current;
    const pos = s.mode === "spring" ? s.target : scroller.scrollLeft;
    return nearestIndex(snapPoints(scroller, track), pos);
  }, [scrollerRef, trackRef]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!(scroller && track)) {
      return;
    }
    const s = state.current;
    const onScroll = () => {
      cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = requestAnimationFrame(() => {
        onIndexRef.current(
          nearestIndex(snapPoints(scroller, track), scroller.scrollLeft)
        );
      });
    };

    const suppressNextClick = () => {
      s.suppressClick = true;
      setTimeout(() => {
        s.suppressClick = false;
      }, 0);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) {
        return;
      }
      if ((e.target as Element).closest("button:not([data-rail-link])")) {
        return;
      }
      clearTimeout(wheelTimer.current);
      cancelAnimationFrame(s.raf);
      // Catching a moving rail keeps its virtual position, overshoot included.
      s.caught = s.mode === "spring";
      s.pos = s.caught ? s.pos : scroller.scrollLeft;
      s.mode = "pressing";
      s.pointerId = e.pointerId;
      s.startX = e.clientX;
      s.startPos = s.pos;
      s.samples = [{ t: e.timeStamp, x: e.clientX }];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== s.pointerId) {
        return;
      }
      const dx = e.clientX - s.startX;
      if (s.mode === "pressing" && Math.abs(dx) > DRAG_THRESHOLD) {
        s.mode = "dragging";
        scroller.setPointerCapture(e.pointerId);
        scroller.dataset.dragging = "true";
        setFree(true);
      }
      if (s.mode !== "dragging") {
        return;
      }
      s.pos = s.startPos - dx;
      apply(s.pos);
      s.samples.push({ t: e.timeStamp, x: e.clientX });
      while (s.samples.length > 2 && e.timeStamp - s.samples[0].t > 100) {
        s.samples.shift();
      }
    };

    const onRelease = (e: PointerEvent) => {
      if (e.pointerId !== s.pointerId) {
        return;
      }
      s.pointerId = -1;
      if (s.mode !== "dragging") {
        if (s.caught) {
          // A rail caught mid-flight (or mid-rubber-band) and let go
          // settles on the nearest card instead of freezing there. Like a
          // native list, the tap that stopped it does not open a card.
          suppressNextClick();
          const points = snapPoints(scroller, track);
          springTo(points[nearestIndex(points, s.pos)], 0);
          return;
        }
        // A press that never became a drag hands back to native snapping.
        s.mode = "idle";
        setFree(false);
        return;
      }
      scroller.dataset.dragging = "false";
      suppressNextClick();
      const v = releaseVelocity(s.samples, e.timeStamp);
      const projected = s.pos + (v * DECELERATION) / (1 - DECELERATION);
      const points = snapPoints(scroller, track);
      springTo(points[nearestIndex(points, projected)], v * 1000);
    };

    // A drag that ends over a card must not follow its link.
    const onClickCapture = (e: MouseEvent) => {
      if (s.suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        s.suppressClick = false;
      }
    };

    // Wheel or touch takes over from a running spring.
    const onNativeInput = () => {
      clearTimeout(wheelTimer.current);
      if (s.mode !== "spring") {
        return;
      }
      cancelAnimationFrame(s.raf);
      s.mode = "idle";
      apply(clamp(s.pos, 0, maxScroll(scroller)));
      setFree(false);
    };

    // Accumulate wheel input into one spring target, then settle on a date after the gesture.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
        onNativeInput();
        return;
      }
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? scroller.clientWidth : 1;
      const target = (s.mode === "spring" ? s.target : scroller.scrollLeft) + e.deltaY * unit;
      springTo(clamp(target, 0, maxScroll(scroller)), s.mode === "spring" ? s.vel : 0);
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => {
        const points = snapPoints(scroller, track);
        springTo(points[nearestIndex(points, s.target)], s.vel);
      }, 140);
    };

    // Arrow keys step one card; Home and End jump to the ends.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== scroller) {
        return;
      }
      const last = track.children.length - 1;
      const index = nearestIndex(
        snapPoints(scroller, track),
        s.mode === "spring" ? s.target : scroller.scrollLeft
      );
      let next = -1;
      switch (e.key) {
        case "ArrowLeft":
          next = index - 1;
          break;
        case "ArrowRight":
          next = index + 1;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = last;
          break;
        default:
          return;
      }
      e.preventDefault();
      goTo(next);
    };

    const points = snapPoints(scroller, track);
    if (points.length) {
      apply(points[0]);
      onIndexRef.current(0);
    }

    scroller.addEventListener("keydown", onKeyDown);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerup", onRelease);
    scroller.addEventListener("pointercancel", onRelease);
    scroller.addEventListener("lostpointercapture", onRelease);
    scroller.addEventListener("click", onClickCapture, true);
    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener("touchstart", onNativeInput, { passive: true });
    return () => {
      cancelAnimationFrame(scrollRaf.current);
      clearTimeout(wheelTimer.current);
      cancelAnimationFrame(s.raf);
      scroller.removeEventListener("keydown", onKeyDown);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", onRelease);
      scroller.removeEventListener("pointercancel", onRelease);
      scroller.removeEventListener("lostpointercapture", onRelease);
      scroller.removeEventListener("click", onClickCapture, true);
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("touchstart", onNativeInput);
    };
  }, [apply, goTo, scrollerRef, setFree, springTo, trackRef]);

  return { goTo, currentIndex };
}

/* ------------------------------------------------------------------ */
/* Rail                                                               */
/* ------------------------------------------------------------------ */


export default function CarouselCards({ children, count, onActiveChange, ref }: { children: ReactNode; count: number; onActiveChange: (index: number) => void; ref: Ref<CarouselHandle> }) {
  const scrollerRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const { goTo, currentIndex } = useMomentumRail(scrollerRef, trackRef, (index) => { setActive(index); onActiveChange(index) })
  useImperativeHandle(ref, () => ({ goTo }), [goTo])
  const arrowClass = 'grid size-11 shrink-0 place-items-center rounded-full bg-white text-foreground ring-1 ring-black/5 transition-[background-color,scale,opacity] hover:bg-zinc-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:pointer-events-none aria-disabled:opacity-30 motion-reduce:transition-none'

  return (
    <div className="@container/rail flex min-h-0 flex-1 flex-col justify-center">
      <motion.section
        layoutScroll
        ref={scrollerRef}
        aria-label="Garments by date"
        aria-roledescription="carousel"
        tabIndex={0}
        className="relative snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-5 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset data-[dragging=true]:cursor-grabbing data-[free=true]:snap-none [&::-webkit-scrollbar]:hidden [@media(pointer:fine)]:cursor-grab [@media(pointer:fine)]:select-none"
        onDragStart={(e) => e.preventDefault()}
      >
        <ul ref={trackRef} className="relative flex w-max items-start gap-4 px-[50cqw]">
          {children}
        </ul>
      </motion.section>
      <div className="mt-2 flex items-center justify-center gap-5 pb-5 sm:mt-4 sm:pb-8">
        <button type="button" aria-label="Previous date" aria-disabled={active === 0} onClick={() => { if (active > 0) goTo(currentIndex() - 1) }} className={arrowClass}>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <p aria-live="polite" aria-atomic="true" className="min-w-24 text-center text-[13px] text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{active + 1}</span> of {count} dates
        </p>
        <button type="button" aria-label="Next date" aria-disabled={active === count - 1} onClick={() => { if (active < count - 1) goTo(currentIndex() + 1) }} className={arrowClass}>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  )
}
