"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Toggle as TogglePrimitive } from "radix-ui"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not(.portrait-svg):not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ballot: "border border-border bg-card text-left whitespace-normal hover:bg-card hover:border-input data-[state=on]:border-primary data-[state=on]:bg-accent",
        campaign: "relative block overflow-hidden border border-border bg-card text-left whitespace-normal shadow-[0_2px_8px_#252b3805] hover:border-input hover:bg-card hover:shadow-[0_5px_18px_#252b380a] data-[state=on]:bg-card data-[state=on]:border-primary data-[state=on]:ring-1 data-[state=on]:ring-primary",
        default: "bg-transparent",
        outline: "border border-input bg-card hover:bg-muted data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
      },
      size: {
        ballot: "h-auto w-full min-w-0 justify-start gap-3 rounded-lg px-4 py-2.5",
        campaign: "h-auto min-w-0 flex-1 rounded-xl p-0",
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
