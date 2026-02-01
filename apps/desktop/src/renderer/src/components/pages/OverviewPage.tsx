import type { Event } from "@satori/domain/domain/event"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CloudSync,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { formatDateTime, formatRelativeTime } from "../../utils/date"
import { Alert, AlertDescription } from "../ui/alert"
import { PageHeader, PageContainer, ContentSection } from "../layout/PageHeader"
import { StatCard, StatCardSkeleton } from "../ui/stat-card"
import { StatusBadge } from "../ui/status-badge"
import { ActivityItem, ActivityList } from "../ui/activity-item"
import { EmptyState } from "../ui/empty-state"
import { Skeleton } from "../ui/skeleton"

export type OverviewStats = {
  readonly eventsCount: number
  readonly peopleCount: number
  readonly pendingOutboxCount: number
  readonly lastAttemptAtMs: number | null
  readonly lastSuccessAtMs: number | null
  readonly lastError: string | null
  readonly recentEvents: ReadonlyArray<Event>
}

export type OverviewPageProps = {
  readonly loading: boolean
  readonly error: string | null
  readonly stats: OverviewStats | null
  readonly onRefresh: () => void
}

const getSyncStatus = (stats: OverviewStats | null): {
  variant: "success" | "error" | "warning" | "pending"
  label: string
} => {
  if (!stats) return { variant: "pending", label: "Loading" }
  if (stats.lastError) return { variant: "error", label: "Error" }
  if (stats.pendingOutboxCount > 0) return { variant: "warning", label: "Pending" }
  if (stats.lastSuccessAtMs) return { variant: "success", label: "Synced" }
  return { variant: "pending", label: "Not synced" }
}

export const OverviewPage = ({
  loading,
  error,
  stats,
  onRefresh,
}: OverviewPageProps): React.JSX.Element => {
  const syncStatus = getSyncStatus(stats)

  return (
    <PageContainer>
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Dashboard"
        description="Overview of your local-first data and sync status."
        badge={<StatusBadge variant={syncStatus.variant} label={syncStatus.label} />}
        actions={
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading && !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Events"
              value={stats?.eventsCount ?? 0}
              icon={<CalendarDays className="h-5 w-5" />}
              variant="primary"
              description="Scheduled activities"
            />
            <StatCard
              title="Total People"
              value={stats?.peopleCount ?? 0}
              icon={<Users className="h-5 w-5" />}
              variant="success"
              description="Registered members"
            />
            <StatCard
              title="Pending Sync"
              value={stats?.pendingOutboxCount ?? 0}
              icon={<CloudSync className="h-5 w-5" />}
              variant={stats?.pendingOutboxCount ? "warning" : "default"}
              description="Outbox items"
            />
            <StatCard
              title="Last Sync"
              value={
                stats?.lastSuccessAtMs
                  ? formatRelativeTime(stats.lastSuccessAtMs)
                  : "Never"
              }
              icon={
                stats?.lastError ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )
              }
              variant={stats?.lastError ? "destructive" : "default"}
              description={
                stats?.lastError
                  ? stats.lastError.slice(0, 40) + (stats.lastError.length > 40 ? "..." : "")
                  : "All changes synced"
              }
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ContentSection title="Recent Events">
          <Card>
            <CardContent className="p-0">
              {loading && !stats ? (
                <div className="divide-y">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recentEvents.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="h-6 w-6" />}
                  title="No events yet"
                  description="Create your first event to get started."
                  className="border-0 bg-transparent"
                />
              ) : (
                <div className="divide-y">
                  {stats?.recentEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(event.startsAtMs)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </ContentSection>

        <ContentSection title="Sync Activity">
          <Card>
            <CardContent className="p-4">
              {loading && !stats ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ActivityList>
                  {stats?.lastSuccessAtMs ? (
                    <ActivityItem
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      variant="success"
                      title="Sync completed successfully"
                      timestamp={formatRelativeTime(stats.lastSuccessAtMs)}
                      showConnector={!!stats.lastAttemptAtMs && stats.lastAttemptAtMs !== stats.lastSuccessAtMs}
                    />
                  ) : null}
                  {stats?.lastAttemptAtMs && stats.lastAttemptAtMs !== stats?.lastSuccessAtMs ? (
                    <ActivityItem
                      icon={stats.lastError ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      variant={stats.lastError ? "error" : "default"}
                      title={stats.lastError ? "Sync failed" : "Sync attempted"}
                      description={stats.lastError ?? undefined}
                      timestamp={formatRelativeTime(stats.lastAttemptAtMs)}
                    />
                  ) : null}
                  {stats?.pendingOutboxCount ? (
                    <ActivityItem
                      icon={<Clock className="h-4 w-4" />}
                      variant="warning"
                      title={`${stats.pendingOutboxCount} item${stats.pendingOutboxCount === 1 ? "" : "s"} pending`}
                      description="Waiting to be synced to server"
                    />
                  ) : null}
                  {!stats?.lastSuccessAtMs && !stats?.lastAttemptAtMs && !stats?.pendingOutboxCount ? (
                    <EmptyState
                      icon={<CloudSync className="h-6 w-6" />}
                      title="No sync activity"
                      description="Your sync history will appear here."
                      className="border-0 bg-transparent py-8"
                    />
                  ) : null}
                </ActivityList>
              )}
            </CardContent>
          </Card>
        </ContentSection>
      </div>
    </PageContainer>
  )
}
