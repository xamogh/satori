import type { Event } from "@satori/shared/domain/event"
import type { SchemaIssue } from "@satori/shared/ipc/contract"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Textarea } from "../ui/textarea"
import { SchemaIssueList } from "../SchemaIssueList"
import { formatDateTime } from "../../utils/date"

export type EventsCreateFormState = {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly startsAt: string
  readonly endsAt: string
  readonly issues: ReadonlyArray<SchemaIssue>
  readonly error: string | null
  readonly onOpenChange: (open: boolean) => void
  readonly onTitleChange: (value: string) => void
  readonly onDescriptionChange: (value: string) => void
  readonly onStartsAtChange: (value: string) => void
  readonly onEndsAtChange: (value: string) => void
  readonly onCancel: () => void
  readonly onSubmit: () => void
}

export type EventsPageProps = {
  readonly query: string
  readonly loading: boolean
  readonly error: string | null
  readonly events: ReadonlyArray<Event>
  readonly onQueryChange: (value: string) => void
  readonly onRefresh: () => void
  readonly onDelete: (id: string) => void
  readonly create: EventsCreateFormState
}

export const EventsPage = ({
  query,
  loading,
  error,
  events,
  onQueryChange,
  onRefresh,
  onDelete,
  create,
}: EventsPageProps): React.JSX.Element => (
  <div className="grid gap-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-2xl font-semibold">Events</div>
        <div className="text-sm text-muted-foreground">
          Create and manage monastery events.
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search title or description…"
          className="w-full sm:w-[280px]"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Loading…" : "Search"}
          </Button>
          <Dialog open={create.open} onOpenChange={create.onOpenChange}>
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
                    value={create.title}
                    onChange={(event) => create.onTitleChange(event.target.value)}
                    placeholder="Sunday service"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={create.description}
                    onChange={(event) => create.onDescriptionChange(event.target.value)}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="event-starts-at">Starts at</Label>
                  <Input
                    id="event-starts-at"
                    type="datetime-local"
                    value={create.startsAt}
                    onChange={(event) => create.onStartsAtChange(event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="event-ends-at">Ends at (optional)</Label>
                  <Input
                    id="event-ends-at"
                    type="datetime-local"
                    value={create.endsAt}
                    onChange={(event) => create.onEndsAtChange(event.target.value)}
                  />
                </div>

                <SchemaIssueList issues={create.issues} />
                {create.error ? (
                  <div className="text-sm text-destructive">{create.error}</div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={create.onCancel}>
                  Cancel
                </Button>
                <Button onClick={create.onSubmit}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>

    {error ? (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    ) : null}

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">All events</CardTitle>
      </CardHeader>
      <CardContent>
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
                    onClick={() => onDelete(event.id)}
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
  </div>
)

