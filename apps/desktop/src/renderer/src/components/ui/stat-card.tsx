import * as React from 'react'
import { cn } from '../../lib/utils'
import { Card, CardContent } from './card'
import { Skeleton } from './skeleton'

export type StatCardProps = {
  readonly title: string
  readonly value: React.ReactNode
  readonly description?: string
  readonly icon: React.ReactNode
  readonly trend?: {
    readonly value: number
    readonly label: string
  }
  readonly loading?: boolean
  readonly variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive'
  readonly className?: string
}

const variantStyles = {
  default: 'bg-muted/50',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  destructive: 'bg-destructive/10 text-destructive'
} as const

export const StatCard = ({
  title,
  value,
  description,
  icon,
  trend,
  loading = false,
  variant = 'default',
  className
}: StatCardProps): React.JSX.Element => (
  <Card className={cn('overflow-hidden', className)}>
    <CardContent className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          )}
          {description && !loading ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          {trend && !loading ? (
            <p
              className={cn(
                'text-xs font-medium',
                trend.value >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            variantStyles[variant]
          )}
        >
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
)

export const StatCardSkeleton = ({
  className
}: {
  readonly className?: string
}): React.JSX.Element => (
  <Card className={cn('overflow-hidden', className)}>
    <CardContent className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </CardContent>
  </Card>
)
