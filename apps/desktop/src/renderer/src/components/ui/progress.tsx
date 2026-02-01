import * as React from 'react'
import { cn } from '../../lib/utils'

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  readonly value?: number
  readonly max?: number
  readonly showLabel?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, showLabel = false, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    return (
      <div className={cn('relative', className)} {...props}>
        <div ref={ref} className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel ? (
          <span className="mt-1 text-xs text-muted-foreground">{Math.round(percentage)}%</span>
        ) : null}
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
