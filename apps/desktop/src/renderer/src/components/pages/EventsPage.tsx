import type { Event } from '@satori/domain/domain/event'
import type { SchemaIssue } from '@satori/ipc-contract/ipc/contract'
import { CalendarDays, Plus, Search, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { DataTable, type DataTableColumn } from '../data-table/DataTable'
import { DataTablePagination } from '../data-table/DataTablePagination'
import { RowActionsMenu } from '../data-table/RowActionsMenu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { SchemaIssueList } from '../SchemaIssueList'
import { formatDateTime } from '../../utils/date'
import { Alert, AlertDescription } from '../ui/alert'
import { PageHeader, PageContainer } from '../layout/PageHeader'
import { EmptyState } from '../ui/empty-state'
import { Badge } from '../ui/badge'

export type EventsCreateFormState = {
  readonly open: boolean
  readonly name: string
  readonly description: string
  readonly startsAt: string
  readonly endsAt: string
  readonly registrationMode: 'PRE_REGISTRATION' | 'WALK_IN'
  readonly issues: ReadonlyArray<SchemaIssue>
  readonly error: string | null
  readonly onOpenChange: (open: boolean) => void
  readonly onNameChange: (value: string) => void
  readonly onDescriptionChange: (value: string) => void
  readonly onStartsAtChange: (value: string) => void
  readonly onEndsAtChange: (value: string) => void
  readonly onRegistrationModeChange: (value: 'PRE_REGISTRATION' | 'WALK_IN') => void
  readonly onCancel: () => void
  readonly onSubmit: () => void
}

export type EventsPageProps = {
  readonly query: string
  readonly loading: boolean
  readonly error: string | null
  readonly events: ReadonlyArray<Event>
  readonly eventsTotal: number
  readonly pageIndex: number
  readonly pageSize: number
  readonly onPageIndexChange: (pageIndex: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
  readonly onQueryChange: (value: string) => void
  readonly onRefresh: () => void
  readonly onDelete: (id: string) => void
  readonly create: EventsCreateFormState
}

const getEventStatus = (
  event: Event
): { label: string; variant: 'default' | 'secondary' | 'outline' } => {
  switch (event.status) {
    case 'ACTIVE':
      return { label: 'Active', variant: 'default' }
    case 'CLOSED':
      return { label: 'Closed', variant: 'secondary' }
    case 'DRAFT':
      return { label: 'Draft', variant: 'outline' }
  }
}

const eventsColumns = (onDelete: (id: string) => void): ReadonlyArray<DataTableColumn<Event>> => [
  {
    id: 'event',
    header: 'Event',
    cell: (event) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{event.name}</p>
          {event.description ? (
            <p className="truncate text-sm text-muted-foreground">{event.description}</p>
          ) : null}
        </div>
      </div>
    )
  },
  {
    id: 'startsAt',
    header: 'Date & Time',
    cell: (event) => (
      <div className="text-sm">
        <p>{formatDateTime(event.startsAtMs)}</p>
        {event.endsAtMs ? (
          <p className="text-muted-foreground">to {formatDateTime(event.endsAtMs)}</p>
        ) : null}
      </div>
    )
  },
  {
    id: 'status',
    header: 'Status',
    headerClassName: 'w-[100px]',
    cell: (event) => {
      const status = getEventStatus(event)
      return <Badge variant={status.variant}>{status.label}</Badge>
    }
  },
  {
    id: 'actions',
    header: '',
    headerClassName: 'w-[56px]',
    cellClassName: 'text-right',
    cell: (event) => (
      <RowActionsMenu
        label="Open event actions"
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: () => onDelete(event.id)
          }
        ]}
      />
    )
  }
]

export const EventsPage = ({
  query,
  loading,
  error,
  events,
  eventsTotal,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  onQueryChange,
  onRefresh,
  onDelete,
  create
}: EventsPageProps): React.JSX.Element => (
  <PageContainer>
    <PageHeader
      icon={<CalendarDays className="h-5 w-5" />}
      title="Events"
      description="Create and manage monastery events and activities."
      badge={eventsTotal > 0 ? <Badge variant="secondary">{eventsTotal} total</Badge> : null}
      actions={
        <Dialog open={create.open} onOpenChange={create.onOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
              <DialogDescription>Add a new event to your calendar.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="event-name">Name</Label>
                <Input
                  id="event-name"
                  value={create.name}
                  onChange={(event) => create.onNameChange(event.target.value)}
                  placeholder="Sunday service"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  value={create.description}
                  onChange={(event) => create.onDescriptionChange(event.target.value)}
                  placeholder="Optional notes about the event"
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="event-registration-mode">Registration mode</Label>
                <select
                  id="event-registration-mode"
                  value={create.registrationMode}
                  onChange={(event) =>
                    create.onRegistrationModeChange(
                      event.target.value === 'WALK_IN' ? 'WALK_IN' : 'PRE_REGISTRATION'
                    )
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="PRE_REGISTRATION">Pre-registration</option>
                  <option value="WALK_IN">Walk-in</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <SchemaIssueList issues={create.issues} />
              {create.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{create.error}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={create.onCancel}>
                Cancel
              </Button>
              <Button onClick={create.onSubmit}>Create Event</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    />

    {error ? (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null}

    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search events..."
          className="pl-8"
        />
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
        {loading ? 'Loading...' : 'Refresh'}
      </Button>
    </div>

    {events.length === 0 && !loading ? (
      <EmptyState
        icon={<CalendarDays className="h-6 w-6" />}
        title="No events found"
        description={
          query ? 'Try adjusting your search terms.' : 'Get started by creating your first event.'
        }
        action={
          !query ? (
            <Button size="sm" onClick={() => create.onOpenChange(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          ) : undefined
        }
      />
    ) : (
      <>
        <DataTable
          columns={eventsColumns(onDelete)}
          rows={events}
          loading={loading}
          getRowKey={(event) => event.id}
        />
        <DataTablePagination
          totalItems={eventsTotal}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={onPageIndexChange}
          onPageSizeChange={onPageSizeChange}
        />
      </>
    )}
  </PageContainer>
)
