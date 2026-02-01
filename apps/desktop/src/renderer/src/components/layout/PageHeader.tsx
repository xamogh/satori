import * as React from "react"
import { cn } from "../../lib/utils"

export type PageHeaderProps = {
  readonly icon?: React.ReactNode
  readonly title: string
  readonly description?: string
  readonly badge?: React.ReactNode
  readonly actions?: React.ReactNode
  readonly className?: string
}

export const PageHeader = ({
  icon,
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element => (
  <div
    className={cn(
      "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
      className
    )}
  >
    <div className="flex items-start gap-3">
      {icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
    {actions ? (
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    ) : null}
  </div>
)

export type PageContainerProps = {
  readonly children: React.ReactNode
  readonly className?: string
}

export const PageContainer = ({
  children,
  className,
}: PageContainerProps): React.JSX.Element => (
  <div className={cn("flex flex-1 flex-col gap-6 min-w-0", className)}>{children}</div>
)

export type ContentSectionProps = {
  readonly title?: string
  readonly description?: string
  readonly actions?: React.ReactNode
  readonly children: React.ReactNode
  readonly className?: string
}

export const ContentSection = ({
  title,
  description,
  actions,
  children,
  className,
}: ContentSectionProps): React.JSX.Element => (
  <section className={cn("space-y-4 min-w-0", className)}>
    {title || actions ? (
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {title ? (
            <h2 className="text-lg font-semibold tracking-tight truncate">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
    ) : null}
    {children}
  </section>
)
