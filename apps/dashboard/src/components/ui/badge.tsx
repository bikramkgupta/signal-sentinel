import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/10 text-primary shadow-glow-cyan",
        secondary:
          "border-muted-foreground/20 bg-secondary text-secondary-foreground",
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-400 shadow-glow-red",
        outline: "border-border text-foreground",
        // Severity variants - high contrast with glow
        critical:
          "border-red-500/40 bg-red-500/15 text-red-400 shadow-glow-red",
        error:
          "border-orange-500/40 bg-orange-500/15 text-orange-400 shadow-glow-amber",
        warn:
          "border-yellow-500/40 bg-yellow-500/15 text-yellow-400 shadow-[0_0_10px_hsl(45_93%_50%/0.3)]",
        info:
          "border-primary/40 bg-primary/15 text-primary shadow-glow-cyan",
        // Status variants
        open:
          "border-red-500/40 bg-red-500/15 text-red-400 shadow-glow-red animate-pulse-glow",
        investigating:
          "border-amber-500/40 bg-amber-500/15 text-amber-400 shadow-glow-amber",
        resolved:
          "border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-glow-green",
        // Job status variants
        queued:
          "border-muted-foreground/30 bg-muted text-muted-foreground",
        running:
          "border-primary/40 bg-primary/15 text-primary shadow-glow-cyan animate-pulse-glow",
        succeeded:
          "border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-glow-green",
        failed:
          "border-red-500/40 bg-red-500/15 text-red-400 shadow-glow-red",
        // Environment badges
        prod:
          "border-red-500/30 bg-red-500/10 text-red-400",
        staging:
          "border-amber-500/30 bg-amber-500/10 text-amber-400",
        dev:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean
}

function Badge({ className, variant, pulse, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        badgeVariants({ variant }),
        pulse && "animate-pulse-glow",
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
