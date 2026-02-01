import type { Event } from '@satori/domain/domain/event'
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
import { formatDateTime } from '../../utils/date'
import { Alert, AlertDescription } from '../ui/alert'
import { PageHeader, PageContainer } from '../layout/PageHeader'
import { EmptyState } from '../ui/empty-state'
import { Badge } from '../ui/badge'
import { FormFieldError } from '../forms/FormFieldError'
import type { FormApiFor } from '../../utils/formTypes'

export type EventsCreateFormValues = {
  readonly name: string
  readonly description: string
  readonly startsAt: string
  readonly endsAt: string
  readonly registrationMode: 'PRE_REGISTRATION' | 'WALK_IN'
  readonly status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  readonly parentEventId: string
  readonly empowermentId: string
  readonly guruId: string
}

export type EventsCreateFormState = {
  readonly open: boolean
  readonly form: FormApiFor<EventsCreateFormValues>
  readonly error: string | null
  readonly onOpenChange: (open: boolean) => void
  readonly onCancel: () => void
}

export type EventsEditFormState = {
  readonly open: boolean
  readonly form: FormApiFor<EventsCreateFormValues>
  readonly eventName: string | null
  readonly error: string | null
  readonly onOpenChange: (open: boolean) => void
  readonly onCancel: () => void
}

export type EventsFormOption = {
  readonly id: string
  readonly label: string
}

export type EventsFormOptions = {
  readonly parents: ReadonlyArray<EventsFormOption>
  readonly empowerments: ReadonlyArray<EventsFormOption>
  readonly gurus: ReadonlyArray<EventsFormOption>
  readonly loading: boolean
  readonly error: string | null
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
  readonly onView: (event: Event) => void
  readonly onEdit: (event: Event) => void
  readonly onDelete: (id: string) => void
  readonly formOptions: EventsFormOptions
  readonly create: EventsCreateFormState
  readonly edit: EventsEditFormState
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

const eventsColumns = (
  onView: (event: Event) => void,
  onEdit: (event: Event) => void,
  onDelete: (id: string) => void
): ReadonlyArray<DataTableColumn<Event>> => [
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
            id: 'view',
            label: 'View details',
            onSelect: () => onView(event)
          },
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => onEdit(event)
          },
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
  onView,
  onEdit,
  onDelete,
  formOptions,
  create,
  edit
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

            <form
              onSubmit={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void create.form.handleSubmit()
              }}
            >
              <div className="grid gap-4 py-4">
                <create.form.Field name="name">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Name</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Sunday service"
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </create.form.Field>

                <create.form.Field name="description">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Description</Label>
                      <Textarea
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Optional notes about the event"
                        rows={3}
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </create.form.Field>

                <div className="grid grid-cols-2 gap-4">
                  <create.form.Field name="registrationMode">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Registration mode</Label>
                        <select
                          id={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(
                              event.target.value === 'WALK_IN' ? 'WALK_IN' : 'PRE_REGISTRATION'
                            )
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="PRE_REGISTRATION">Pre-registration</option>
                          <option value="WALK_IN">Walk-in</option>
                        </select>
                        <FormFieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </create.form.Field>

                  <create.form.Field name="status">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Status</Label>
                        <select
                          id={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(
                              event.target.value === 'ACTIVE'
                                ? 'ACTIVE'
                                : event.target.value === 'CLOSED'
                                  ? 'CLOSED'
                                  : 'DRAFT'
                            )
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="ACTIVE">Active</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                        <FormFieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </create.form.Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <create.form.Field name="parentEventId">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Parent event</Label>
                        <select
                          id={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          disabled={formOptions.loading}
                        >
                          <option value="">None</option>
                          {formOptions.parents.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <FormFieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </create.form.Field>

                  <create.form.Field name="empowermentId">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Empowerment</Label>
                        <select
                          id={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          disabled={formOptions.loading}
                        >
                          <option value="">None</option>
                          {formOptions.empowerments.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <FormFieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </create.form.Field>
                </div>

                <create.form.Field name="guruId">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Guru</Label>
                      <select
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        disabled={formOptions.loading}
                      >
                        <option value="">None</option>
                        {formOptions.gurus.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </create.form.Field>

                <div className="grid grid-cols-2 gap-4">
                  <create.form.Field name="startsAt">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Starts at</Label>
                        <Input
                          id={field.name}
                          type="datetime-local"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </create.form.Field>

                  <create.form.Field name="endsAt">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Ends at (optional)</Label>
                        <Input
                          id={field.name}
                          type="datetime-local"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                        <FormFieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </create.form.Field>
                </div>

                {formOptions.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{formOptions.error}</AlertDescription>
                  </Alert>
                ) : null}

                {create.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{create.error}</AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={create.onCancel}>
                  Cancel
                </Button>
                <create.form.Subscribe
                  selector={(state) => ({
                    canSubmit: state.canSubmit,
                    isSubmitting: state.isSubmitting
                  })}
                >
                  {({ canSubmit, isSubmitting }) => (
                    <Button type="submit" disabled={!canSubmit}>
                      {isSubmitting ? 'Saving...' : 'Create Event'}
                    </Button>
                  )}
                </create.form.Subscribe>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    />

    <Dialog open={edit.open} onOpenChange={edit.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{edit.eventName ? `Edit ${edit.eventName}` : 'Edit Event'}</DialogTitle>
          <DialogDescription>Update event details and scheduling.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void edit.form.handleSubmit()
          }}
        >
          <div className="grid gap-4 py-4">
            <edit.form.Field name="name">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Name</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Sunday service"
                  />
                  <FormFieldError errors={field.state.meta.errors} />
                </div>
              )}
            </edit.form.Field>

            <edit.form.Field name="description">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Description</Label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Optional notes about the event"
                    rows={3}
                  />
                  <FormFieldError errors={field.state.meta.errors} />
                </div>
              )}
            </edit.form.Field>

            <div className="grid grid-cols-2 gap-4">
              <edit.form.Field name="registrationMode">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Registration mode</Label>
                    <select
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(
                          event.target.value === 'WALK_IN' ? 'WALK_IN' : 'PRE_REGISTRATION'
                        )
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="PRE_REGISTRATION">Pre-registration</option>
                      <option value="WALK_IN">Walk-in</option>
                    </select>
                    <FormFieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </edit.form.Field>

              <edit.form.Field name="status">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Status</Label>
                    <select
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(
                          event.target.value === 'ACTIVE'
                            ? 'ACTIVE'
                            : event.target.value === 'CLOSED'
                              ? 'CLOSED'
                              : 'DRAFT'
                        )
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                    <FormFieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </edit.form.Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <edit.form.Field name="parentEventId">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Parent event</Label>
                    <select
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={formOptions.loading}
                    >
                      <option value="">None</option>
                      {formOptions.parents.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <FormFieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </edit.form.Field>

              <edit.form.Field name="empowermentId">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Empowerment</Label>
                    <select
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={formOptions.loading}
                    >
                      <option value="">None</option>
                      {formOptions.empowerments.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <FormFieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </edit.form.Field>
            </div>

            <edit.form.Field name="guruId">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Guru</Label>
                  <select
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    disabled={formOptions.loading}
                  >
                    <option value="">None</option>
                    {formOptions.gurus.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <FormFieldError errors={field.state.meta.errors} />
                </div>
              )}
            </edit.form.Field>

            <div className="grid grid-cols-2 gap-4">
              <edit.form.Field name="startsAt">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Starts at</Label>
                    <Input
                      id={field.name}
                      type="datetime-local"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <FormFieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </edit.form.Field>

              <edit.form.Field name="endsAt">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Ends at (optional)</Label>
                    <Input
                      id={field.name}
                      type="datetime-local"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <FormFieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </edit.form.Field>
            </div>

            {formOptions.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formOptions.error}</AlertDescription>
              </Alert>
            ) : null}

            {edit.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{edit.error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={edit.onCancel}>
              Cancel
            </Button>
            <edit.form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
              )}
            </edit.form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

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
          columns={eventsColumns(onView, onEdit, onDelete)}
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
