import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

// shadcn slider, edited for FashMap: thin indigo track, larger thumbs, a label per thumb.
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels = [],
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex h-5 w-full touch-none items-center select-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-black/8"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary select-none" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabels[index]}
          className="relative block size-[18px] shrink-0 cursor-grab rounded-full border border-black/10 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.12),0_3px_8px_-2px_rgb(0_0_0/0.18)] transition-[box-shadow,transform] select-none after:absolute after:-inset-2.5 hover:ring-4 hover:ring-primary/10 focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:outline-hidden active:scale-110 active:cursor-grabbing motion-reduce:transition-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
