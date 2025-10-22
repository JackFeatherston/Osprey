import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { badgeVariants as badgeMotionVariants } from "@/lib/animations"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-red-600 text-white hover:bg-red-700",
        outline: "text-foreground border-current",
        success:
          "border-transparent bg-green-600 text-white hover:bg-green-700 shadow-sm",
        warning:
          "border-transparent bg-yellow-600 text-white hover:bg-yellow-700 shadow-sm",
        info:
          "border-transparent bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        glass:
          "border-white/20 bg-white/10 backdrop-blur-md text-white shadow-lg",
        pending:
          "border-transparent bg-yellow-500/20 text-yellow-600 border border-yellow-500/30",
        approved:
          "border-transparent bg-green-500/20 text-green-600 border border-green-500/30 glow-green",
        rejected:
          "border-transparent bg-red-500/20 text-red-600 border border-red-500/30 glow-red",
        executed:
          "border-transparent bg-blue-500/20 text-blue-600 border border-blue-500/30",
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
  animated?: boolean
}

function Badge({ className, variant, animated = false, ...props }: BadgeProps) {
  const Component = animated ? motion.div : "div"
  const motionProps = animated
    ? {
        initial: "hidden",
        animate: "visible",
        variants: badgeMotionVariants,
      }
    : {}

  return (
    <Component
      className={cn(badgeVariants({ variant }), className)}
      {...motionProps}
      {...props}
    />
  )
}

export { Badge, badgeVariants }