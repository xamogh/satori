import { useCallback, useEffect, useMemo, useState } from "react"
import { Either, Schema } from "effect"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Textarea } from "../components/ui/textarea"
import { SchemaIssueList } from "../components/SchemaIssueList"
import { formatDateTime } from "../utils/date"
import {
  EventCreateInputSchema,
  type Event,
} from "@satori/domain/domain/event"
import { formatParseIssues } from "@satori/ipc-contract/utils/parseIssue"
import type { SchemaIssue } from "@satori/ipc-contract/ipc/contract"

const normalizeQuery = (raw: string): string | undefined => {
  const trimmed = raw.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const parseDateTimeLocalMs = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return null
  }

  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? ms : null
}

export const EventsView = (): React.JSX.Element => {
  const [query, setQuery] = useState("")
  const normalizedQuery = useMemo(() => normalizeQuery(query), [query])

  const [events, setEvents] = useState<ReadonlyArray<Event>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createStartsAt, setCreateStartsAt] = useState("")
  const [createEndsAt, setCreateEndsAt] = useState("")
  const [createIssues, setCreateIssues] = useState<ReadonlyArray<SchemaIssue>>([])
  const [createError, setCreateError] = useState<string>("")

  const refresh = useCallback((): void => {
    setLoading(true)
    setError("")

    window.api
      .eventsList({ query: normalizedQuery })
      .then(
        (result) => {
          if (result._tag === "Ok") {
            setEvents(result.value)
            return
          }

          setError(result.error.message)
        },
        (reason) => setError(String(reason))
      )
      .finally(() => setLoading(false))
  }, [normalizedQuery])

  useEffect(() => {
    const id = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(id)
  }, [refresh])

  const submitCreate = useCallback((): void => {
    setCreateError("")

    const startsAtMs = parseDateTimeLocalMs(createStartsAt)
    if (startsAtMs === null) {
      setCreateIssues([])
      setCreateError("Start date/time is required.")
      return
    }

    const endsAtMs = parseDateTimeLocalMs(createEndsAt)
    if (createEndsAt.trim().length > 0 && endsAtMs === null) {
      setCreateIssues([])
      setCreateError("End date/time is invalid.")
      return
    }

    const decoded = Schema.decodeUnknownEither(EventCreateInputSchema)({
      title: createTitle,
      description: createDescription.trim().length === 0 ? null : createDescription,
      startsAtMs,
      endsAtMs,
    })

    if (Either.isLeft(decoded)) {
      setCreateIssues(formatParseIssues(decoded.left))
      return
    }

    setCreateIssues([])
    window.api.eventsCreate(decoded.right).then(
      (result) => {
        if (result._tag === "Ok") {
          setCreateOpen(false)
          setCreateTitle("")
          setCreateDescription("")
          setCreateStartsAt("")
          setCreateEndsAt("")
          refresh()
          return
        }

        setCreateError(result.error.message)
      },
      (reason) => setCreateError(String(reason))
    )
  }, [createDescription, createEndsAt, createStartsAt, createTitle, refresh])

  const deleteEvent = useCallback(
    (id: string): void => {
      setError("")
      window.api.eventsDelete({ id }).then(
        (result) => {
          if (result._tag === "Ok") {
            refresh()
            return
          }
          setError(result.error.message)
        },
        (reason) => setError(String(reason))
      )
    },
    [refresh]
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Events</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or description…"
            className="w-[260px]"
          />
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "Search"}
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create event</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="event-title">Title</Label>
                  <Input
                    id="event-title"
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.target.value)}
                    placeholder="Sunday service"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={createDescription}
                    onChange={(event) => setCreateDescription(event.target.value)}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="event-starts-at">Starts at</Label>
                  <Input
                    id="event-starts-at"
                    type="datetime-local"
                    value={createStartsAt}
                    onChange={(event) => setCreateStartsAt(event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="event-ends-at">Ends at (optional)</Label>
                  <Input
                    id="event-ends-at"
                    type="datetime-local"
                    value={createEndsAt}
                    onChange={(event) => setCreateEndsAt(event.target.value)}
                  />
                </div>

                <SchemaIssueList issues={createIssues} />
                {createError.length > 0 ? (
                  <div className="text-sm text-destructive">{createError}</div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {error.length > 0 ? (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.title}</TableCell>
                <TableCell>{formatDateTime(event.startsAtMs)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteEvent(event.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  No events found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
