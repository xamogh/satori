import * as React from "react"
import { cn } from "../../lib/utils"

export type EmptyStateProps = {
  readonly icon: React.ReactNode
  readonly title: string
  readonly description?: string
  readonly action?: React.ReactNode
  readonly className?: string
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.JSX.Element => (
  <div
    className={cn(
      "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center",
      className
    )}
  >
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {icon}
    </div>
    <h3 className="text-base font-semibold">{title}</h3>
    {description ? (
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    ) : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
)
