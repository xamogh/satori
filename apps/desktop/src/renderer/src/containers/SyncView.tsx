import { useCallback, useEffect, useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { formatDateTime } from "../utils/date"
import type { SyncStatus } from "@satori/domain/sync/schemas"

const formatMaybeTime = (ms: number | null): string => (ms === null ? "—" : formatDateTime(ms))

export const SyncView = (): React.JSX.Element => {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const refresh = useCallback((): void => {
    setLoading(true)
    setError("")
    window.api
      .syncStatus()
      .then(
        (result) => {
          if (result._tag === "Ok") {
            setStatus(result.value)
            return
          }
          setError(result.error.message)
        },
        (reason) => setError(reason instanceof Error ? reason.message : String(reason))
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(id)
  }, [refresh])

  const runSyncNow = useCallback((): void => {
    setLoading(true)
    setError("")
    window.api
      .syncNow()
      .then(
        (result) => {
          if (result._tag === "Ok") {
            setStatus(result.value)
            return
          }
          setError(result.error.message)
        },
        (reason) => setError(reason instanceof Error ? reason.message : String(reason))
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Sync</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={runSyncNow} disabled={loading}>
            Sync now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error.length > 0 ? (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-2 text-sm">
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
            <div className="font-medium text-right">{status?.lastError ?? "—"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
