import type { SyncStatus } from "@satori/domain/sync/schemas"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { formatDateTime } from "../../utils/date"

export type SyncPageProps = {
  readonly status: SyncStatus | null
  readonly loading: boolean
  readonly error: string | null
  readonly onRefresh: () => void
  readonly onSyncNow: () => void
}

const formatMaybeTime = (ms: number | null): string => (ms === null ? "—" : formatDateTime(ms))

export const SyncPage = ({
  status,
  loading,
  error,
  onRefresh,
  onSyncNow,
}: SyncPageProps): React.JSX.Element => (
  <div className="grid gap-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-2xl font-semibold">Sync</div>
        <div className="text-sm text-muted-foreground">
          Push local changes and pull remote updates.
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
        <Button onClick={onSyncNow} disabled={loading}>
          Sync now
        </Button>
      </div>
    </div>

    {error ? (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    ) : null}

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">Pending outbox</div>
          <div className="font-medium">{status?.pendingOutboxCount ?? "—"}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">Last attempt</div>
          <div className="font-medium">
            {status ? formatMaybeTime(status.lastAttemptAtMs) : "—"}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">Last success</div>
          <div className="font-medium">
            {status ? formatMaybeTime(status.lastSuccessAtMs) : "—"}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">Last error</div>
          <div className="max-w-[380px] truncate text-right font-medium">
            {status?.lastError ?? "—"}
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
)
