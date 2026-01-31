import type { Event } from "@satori/domain/domain/event"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { formatDateTime } from "../../utils/date"

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

const formatMaybeTime = (ms: number | null): string => (ms === null ? "—" : formatDateTime(ms))

export const OverviewPage = ({
  loading,
  error,
  stats,
  onRefresh,
}: OverviewPageProps): React.JSX.Element => (
  <div className="grid gap-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-2xl font-semibold">Dashboard</div>
        <div className="text-sm text-muted-foreground">
          Local-first data with optional sync.
        </div>
      </div>
      <Button variant="secondary" onClick={onRefresh} disabled={loading}>
        {loading ? "Refreshing…" : "Refresh"}
      </Button>
    </div>

    {error ? (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    ) : null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{stats?.eventsCount ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">People</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{stats?.peopleCount ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Pending outbox</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">
            {stats?.pendingOutboxCount ?? "—"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Sync</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-muted-foreground">Last success</div>
            <div className="font-medium">{formatMaybeTime(stats?.lastSuccessAtMs ?? null)}</div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-muted-foreground">Last attempt</div>
            <div className="font-medium">{formatMaybeTime(stats?.lastAttemptAtMs ?? null)}</div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-muted-foreground">Last error</div>
            <div className="truncate text-right font-medium">{stats?.lastError ?? "—"}</div>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent events</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Starts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(stats?.recentEvents ?? []).map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.title}</TableCell>
                <TableCell>{formatDateTime(event.startsAtMs)}</TableCell>
              </TableRow>
            ))}
            {(stats?.recentEvents ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                  No recent events.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
)
