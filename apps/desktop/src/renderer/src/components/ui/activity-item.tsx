import * as React from 'react'
import { cn } from '../../lib/utils'

export type ActivityItemProps = {
  readonly icon: React.ReactNode
  readonly title: React.ReactNode
  readonly description?: React.ReactNode
  readonly timestamp?: React.ReactNode
  readonly variant?: 'default' | 'success' | 'error' | 'warning'
  readonly showConnector?: boolean
  readonly className?: string
}

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
} as const

export const ActivityItem = ({
  icon,
  title,
  description,
  timestamp,
  variant = 'default',
  showConnector = false,
  className
}: ActivityItemProps): React.JSX.Element => (
  <div className={cn('relative flex gap-3 min-w-0', className)}>
    {showConnector ? (
      <div className="absolute left-4 top-10 h-[calc(100%-1rem)] w-px bg-border" />
    ) : null}
    <div
      className={cn(
        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        iconVariantStyles[variant]
      )}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0 space-y-1 pt-0.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight truncate">{title}</p>
        {timestamp ? (
          <span className="shrink-0 text-xs text-muted-foreground">{timestamp}</span>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm text-muted-foreground break-words line-clamp-2">{description}</p>
      ) : null}
    </div>
  </div>
)

export const ActivityList = ({
  children,
  className
}: {
  readonly children: React.ReactNode
  readonly className?: string
}): React.JSX.Element => <div className={cn('space-y-4', className)}>{children}</div>
