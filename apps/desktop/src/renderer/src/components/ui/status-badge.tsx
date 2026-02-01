import * as React from "react"
import { CheckCircle2, AlertCircle, Clock, Loader2, Circle } from "lucide-react"
import { cn } from "../../lib/utils"

export type StatusBadgeVariant = "success" | "error" | "warning" | "pending" | "default" | "syncing"

export type StatusBadgeProps = {
  readonly variant: StatusBadgeVariant
  readonly label?: string
  readonly showIcon?: boolean
  readonly className?: string
}

const variantConfig = {
  success: {
    icon: CheckCircle2,
    styles: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  error: {
    icon: AlertCircle,
    styles: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  warning: {
    icon: AlertCircle,
    styles: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  pending: {
    icon: Clock,
    styles: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  syncing: {
    icon: Loader2,
    styles: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  default: {
    icon: Circle,
    styles: "bg-muted text-muted-foreground border-border",
  },
} as const

export const StatusBadge = ({
  variant,
  label,
  showIcon = true,
  className,
}: StatusBadgeProps): React.JSX.Element => {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.styles,
        className
      )}
    >
      {showIcon ? (
        <Icon
          className={cn(
            "h-3 w-3",
            variant === "syncing" && "animate-spin"
          )}
        />
      ) : null}
      {label}
    </span>
  )
}
