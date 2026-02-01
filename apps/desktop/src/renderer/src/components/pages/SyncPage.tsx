import type { SyncStatus } from "@satori/domain/sync/schemas"
import {
  CloudSync,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Upload,
  Loader2,
} from "lucide-react"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { formatDateTime, formatRelativeTime } from "../../utils/date"
import { Alert, AlertDescription } from "../ui/alert"
import { PageHeader, PageContainer, ContentSection } from "../layout/PageHeader"
import { StatusBadge } from "../ui/status-badge"
import { Progress } from "../ui/progress"
import { ActivityItem, ActivityList } from "../ui/activity-item"
import { EmptyState } from "../ui/empty-state"
import { Skeleton } from "../ui/skeleton"

export type SyncPageProps = {
  readonly status: SyncStatus | null
  readonly loading: boolean
  readonly error: string | null
  readonly onRefresh: () => void
  readonly onSyncNow: () => void
}

const getSyncStatusInfo = (status: SyncStatus | null, loading: boolean): {
  variant: "success" | "error" | "warning" | "pending" | "syncing"
  label: string
} => {
  if (loading) return { variant: "syncing", label: "Syncing" }
  if (!status) return { variant: "pending", label: "Unknown" }
  if (status.lastError) return { variant: "error", label: "Error" }
  if (status.pendingOutboxCount > 0) return { variant: "warning", label: "Pending" }
  if (status.lastSuccessAtMs) return { variant: "success", label: "Synced" }
  return { variant: "pending", label: "Not synced" }
}

export const SyncPage = ({
  status,
  loading,
  error,
  onRefresh,
  onSyncNow,
}: SyncPageProps): React.JSX.Element => {
  const syncInfo = getSyncStatusInfo(status, loading)
  const hasActivity = status?.lastSuccessAtMs || status?.lastAttemptAtMs || status?.pendingOutboxCount

  return (
    <PageContainer>
      <PageHeader
        icon={<CloudSync className="h-5 w-5" />}
        title="Sync"
        description="Push local changes and pull remote updates."
        badge={<StatusBadge variant={syncInfo.variant} label={syncInfo.label} />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
            <Button size="sm" onClick={onSyncNow} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Sync Now
            </Button>
          </div>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ContentSection title="Sync Status">
          <Card>
            <CardContent className="p-6">
              {!status && loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pending items</span>
                      <span className="font-medium">{status?.pendingOutboxCount ?? 0}</span>
                    </div>
                    <Progress
                      value={status?.pendingOutboxCount ?? 0}
                      max={Math.max(status?.pendingOutboxCount ?? 0, 10)}
                      className={status?.pendingOutboxCount ? "" : "opacity-50"}
                    />
                    {status?.pendingOutboxCount ? (
                      <p className="text-xs text-muted-foreground">
                        {status.pendingOutboxCount} item{status.pendingOutboxCount === 1 ? "" : "s"} waiting to sync
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        All changes have been synced
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-muted-foreground">Last successful sync</span>
                      </div>
                      <span className="text-sm font-medium">
                        {status?.lastSuccessAtMs ? formatRelativeTime(status.lastSuccessAtMs) : "Never"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Last attempt</span>
                      </div>
                      <span className="text-sm font-medium">
                        {status?.lastAttemptAtMs ? formatRelativeTime(status.lastAttemptAtMs) : "Never"}
                      </span>
                    </div>

                    {status?.lastError ? (
                      <div className="rounded-lg bg-destructive/10 p-3 overflow-hidden">
                        <div className="flex items-start gap-2 min-w-0">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div className="space-y-1 min-w-0 overflow-hidden">
                            <p className="text-sm font-medium text-destructive">Last error</p>
                            <p className="text-sm text-destructive/80 break-words line-clamp-3">{status.lastError}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </ContentSection>

        <ContentSection title="Sync Activity">
          <Card>
            <CardContent className="p-6">
              {!status && loading ? (
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
              ) : !hasActivity ? (
                <EmptyState
                  icon={<CloudSync className="h-6 w-6" />}
                  title="No sync activity yet"
                  description="Your sync history will appear here once you start syncing."
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                <ActivityList>
                  {loading ? (
                    <ActivityItem
                      icon={<Loader2 className="h-4 w-4 animate-spin" />}
                      variant="default"
                      title="Syncing..."
                      description="Pushing changes and pulling updates"
                      showConnector={true}
                    />
                  ) : null}

                  {status?.lastSuccessAtMs ? (
                    <ActivityItem
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      variant="success"
                      title="Sync completed"
                      description="All changes pushed successfully"
                      timestamp={formatDateTime(status.lastSuccessAtMs)}
                      showConnector={
                        !!status.lastAttemptAtMs &&
                        status.lastAttemptAtMs !== status.lastSuccessAtMs
                      }
                    />
                  ) : null}

                  {status?.lastAttemptAtMs &&
                  status.lastAttemptAtMs !== status?.lastSuccessAtMs ? (
                    <ActivityItem
                      icon={
                        status.lastError ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )
                      }
                      variant={status.lastError ? "error" : "default"}
                      title={status.lastError ? "Sync failed" : "Sync attempted"}
                      description={status.lastError ?? "Connection attempt made"}
                      timestamp={formatDateTime(status.lastAttemptAtMs)}
                    />
                  ) : null}

                  {status?.pendingOutboxCount ? (
                    <ActivityItem
                      icon={<Upload className="h-4 w-4" />}
                      variant="warning"
                      title={`${status.pendingOutboxCount} pending change${status.pendingOutboxCount === 1 ? "" : "s"}`}
                      description="Waiting to be synced to the server"
                    />
                  ) : null}
                </ActivityList>
              )}
            </CardContent>
          </Card>
        </ContentSection>
      </div>

      <ContentSection title="How Sync Works">
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-lg font-bold">1</span>
                </div>
                <h3 className="font-medium">Local Changes</h3>
                <p className="text-sm text-muted-foreground">
                  All changes are saved locally first, so you can work offline.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-lg font-bold">2</span>
                </div>
                <h3 className="font-medium">Outbox Queue</h3>
                <p className="text-sm text-muted-foreground">
                  Changes are queued in the outbox until they can be synced.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-lg font-bold">3</span>
                </div>
                <h3 className="font-medium">Push & Pull</h3>
                <p className="text-sm text-muted-foreground">
                  When online, changes are pushed to the server and updates are pulled down.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </ContentSection>
    </PageContainer>
  )
}
