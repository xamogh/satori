import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useForm } from '@tanstack/react-form'
import { Either } from 'effect'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Plus,
  RefreshCw,
  Users
} from 'lucide-react'
import {
  EventAttendeeCreateInputSchema,
  EventAttendeeUpdateInputSchema,
  EventDayCreateInputSchema,
  type Event,
  type EventAttendee,
  type EventAttendeeCreateInput,
  type EventAttendeeUpdateInput,
  type EventDay,
  type EventDayCreateInput
} from '@satori/domain/domain/event'
import type { Attendance } from '@satori/domain/domain/attendance'
import type { Person } from '@satori/domain/domain/person'
import type { SchemaIssue } from '@satori/ipc-contract/ipc/contract'
import { createStore } from '../utils/store'
import { createSchemaFormValidator } from '../utils/formValidation'
import {
  formatDate,
  formatDateTime,
  formatDateTimeLocalInput,
  parseDateTimeLocalMs
} from '../utils/date'
import { trimToNull } from '../utils/string'
import { PageContainer, PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { DataTable, type DataTableColumn } from '../components/data-table/DataTable'
import { RowActionsMenu } from '../components/data-table/RowActionsMenu'
import { EmptyState } from '../components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { FormFieldError } from '../components/forms/FormFieldError'

export type EventDetailContainerProps = {
  readonly eventId: string
  readonly onBack: () => void
}

type EventDetailState = {
  readonly event: Event | null
  readonly days: ReadonlyArray<EventDay>
  readonly attendees: ReadonlyArray<EventAttendee>
  readonly attendance: ReadonlyArray<Attendance>
  readonly people: ReadonlyArray<Person>
  readonly loading: boolean
  readonly error: string | null
}

const eventDetailStore = createStore<EventDetailState>({
  event: null,
  days: [],
  attendees: [],
  attendance: [],
  people: [],
  loading: false,
  error: null
})

let eventDetailRequestId = 0
let eventDetailEventId: string | null = null

const refreshEventDetail = (eventId: string): Promise<void> => {
  eventDetailRequestId += 1
  const requestId = eventDetailRequestId

  eventDetailStore.updateSnapshot((current) => ({
    ...current,
    loading: true,
    error: null
  }))

  return Promise.all([
    window.api.eventsList({ query: undefined }),
    window.api.eventDaysList({ eventId }),
    window.api.eventAttendeesList({ eventId }),
    window.api.attendanceList({ eventId }),
    window.api.personsList({ query: undefined })
  ]).then(
    ([eventsResult, daysResult, attendeesResult, attendanceResult, peopleResult]) => {
      if (eventDetailRequestId !== requestId) {
        return
      }

      if (eventsResult._tag !== 'Ok') {
        eventDetailStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: eventsResult.error.message
        }))
        return
      }

      if (daysResult._tag !== 'Ok') {
        eventDetailStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: daysResult.error.message
        }))
        return
      }

      if (attendeesResult._tag !== 'Ok') {
        eventDetailStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: attendeesResult.error.message
        }))
        return
      }

      if (attendanceResult._tag !== 'Ok') {
        eventDetailStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: attendanceResult.error.message
        }))
        return
      }

      if (peopleResult._tag !== 'Ok') {
        eventDetailStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: peopleResult.error.message
        }))
        return
      }

      const event = eventsResult.value.find((item) => item.id === eventId) ?? null

      if (!event) {
        eventDetailStore.setSnapshot({
          event: null,
          days: daysResult.value,
          attendees: attendeesResult.value,
          attendance: attendanceResult.value,
          people: peopleResult.value,
          loading: false,
          error: 'Event not found.'
        })
        return
      }

      eventDetailStore.setSnapshot({
        event,
        days: daysResult.value,
        attendees: attendeesResult.value,
        attendance: attendanceResult.value,
        people: peopleResult.value,
        loading: false,
        error: null
      })
    },
    (reason) => {
      if (eventDetailRequestId !== requestId) {
        return
      }

      eventDetailStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: String(reason)
      }))
    }
  )
}

const subscribeEventDetail = (eventId: string, listener: () => void): (() => void) => {
  if (eventDetailEventId !== eventId) {
    eventDetailEventId = eventId
    void refreshEventDetail(eventId)
  }

  return eventDetailStore.subscribe(listener)
}

const getFullName = (person: Person): string =>
  [person.firstName, person.middleName, person.lastName]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')

const makeAttendanceKey = (attendeeId: string, dayId: string): string => `${attendeeId}:${dayId}`

type EventDayFormValues = {
  readonly dayNumber: string
  readonly date: string
}

type AttendeeFormValues = {
  readonly personId: string
  readonly registrationMode: 'PRE_REGISTRATION' | 'WALK_IN'
  readonly registeredAt: string
  readonly registeredBy: string
  readonly registeredForDayId: string
  readonly notes: string
  readonly isCancelled: boolean
  readonly attendanceOverrideStatus: '' | 'attended' | 'not_attended'
  readonly attendanceOverrideNote: string
}

type AttendeeRow = {
  readonly attendee: EventAttendee
  readonly person: Person | null
}

const eventDayColumns = (onDelete: (id: string) => void): ReadonlyArray<DataTableColumn<EventDay>> => [
  {
    id: 'day',
    header: 'Day',
    cell: (day) => <span className="font-medium">Day {day.dayNumber}</span>
  },
  {
    id: 'date',
    header: 'Date',
    cell: (day) => <span className="text-sm">{formatDate(day.dateMs)}</span>
  },
  {
    id: 'actions',
    header: '',
    headerClassName: 'w-[56px]',
    cellClassName: 'text-right',
    cell: (day) => (
      <RowActionsMenu
        label="Open day actions"
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: () => onDelete(day.id)
          }
        ]}
      />
    )
  }
]

const attendeeColumns = (
  onEdit: (attendee: EventAttendee) => void,
  onDelete: (attendeeId: string) => void
): ReadonlyArray<DataTableColumn<AttendeeRow>> => [
  {
    id: 'person',
    header: 'Person',
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">
          {row.person ? getFullName(row.person) : row.attendee.personId}
        </p>
        {row.person?.email ? (
          <p className="truncate text-sm text-muted-foreground">{row.person.email}</p>
        ) : null}
      </div>
    )
  },
  {
    id: 'registration',
    header: 'Registration',
    cell: (row) => (
      <div className="text-sm">
        <p className="font-medium">{row.attendee.registrationMode}</p>
        {row.attendee.registeredAtMs ? (
          <p className="text-muted-foreground">
            {formatDateTime(row.attendee.registeredAtMs)}
          </p>
        ) : null}
        {row.attendee.registeredBy ? (
          <p className="text-muted-foreground">By {row.attendee.registeredBy}</p>
        ) : null}
      </div>
    )
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <div className="text-sm">
        {row.attendee.isCancelled ? (
          <Badge variant="destructive">Cancelled</Badge>
        ) : (
          <Badge variant="secondary">Active</Badge>
        )}
        {row.attendee.attendanceOverrideStatus ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Override: {row.attendee.attendanceOverrideStatus.replace('_', ' ')}
          </p>
        ) : null}
      </div>
    )
  },
  {
    id: 'actions',
    header: '',
    headerClassName: 'w-[56px]',
    cellClassName: 'text-right',
    cell: (row) => (
      <RowActionsMenu
        label="Open attendee actions"
        actions={[
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => onEdit(row.attendee)
          },
          {
            id: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: () => onDelete(row.attendee.id)
          }
        ]}
      />
    )
  }
]

export const EventDetailContainer = ({
  eventId,
  onBack
}: EventDetailContainerProps): React.JSX.Element => {
  const detail = useSyncExternalStore(
    (listener) => subscribeEventDetail(eventId, listener),
    eventDetailStore.getSnapshot,
    eventDetailStore.getSnapshot
  )

  const [dayCreateOpen, setDayCreateOpen] = useState(false)
  const [dayCreateError, setDayCreateError] = useState<string | null>(null)
  const [attendeeCreateOpen, setAttendeeCreateOpen] = useState(false)
  const [attendeeCreateError, setAttendeeCreateError] = useState<string | null>(null)
  const [attendeeEditOpen, setAttendeeEditOpen] = useState(false)
  const [attendeeEditError, setAttendeeEditError] = useState<string | null>(null)
  const [attendeeEditTarget, setAttendeeEditTarget] = useState<EventAttendee | null>(null)

  const event = detail.event

  const days = useMemo(
    () => [...detail.days].sort((left, right) => left.dayNumber - right.dayNumber),
    [detail.days]
  )

  const attendeeRows = useMemo<ReadonlyArray<AttendeeRow>>(() => {
    const personMap = new Map(detail.people.map((person) => [person.id, person]))
    return detail.attendees.map((attendee) => ({
      attendee,
      person: personMap.get(attendee.personId) ?? null
    }))
  }, [detail.attendees, detail.people])

  const attendanceMap = useMemo(() => {
    const entries: ReadonlyArray<readonly [string, Attendance]> = detail.attendance.map(
      (record) => [makeAttendanceKey(record.eventAttendeeId, record.eventDayId), record]
    )
    return new Map(entries)
  }, [detail.attendance])

  const peopleOptions = useMemo(
    () =>
      detail.people.map((person) => ({
        id: person.id,
        label: getFullName(person)
      })),
    [detail.people]
  )

  const dayDefaults: EventDayFormValues = useMemo(
    () => ({
      dayNumber: String(days.length + 1),
      date: ''
    }),
    [days.length]
  )

  const buildEventDayInput = useCallback(
    (values: EventDayFormValues): Either.Either<EventDayCreateInput, ReadonlyArray<SchemaIssue>> => {
      const dayNumber = Number(values.dayNumber)
      if (!Number.isFinite(dayNumber) || dayNumber <= 0) {
        return Either.left([
          {
            path: ['dayNumber'],
            message: 'Day number must be a positive number.'
          }
        ])
      }

      const trimmed = values.date.trim()
      if (trimmed.length === 0) {
        return Either.left([
          {
            path: ['date'],
            message: 'Date is required.'
          }
        ])
      }

      const dateMs = Date.parse(trimmed)
      if (!Number.isFinite(dateMs)) {
        return Either.left([
          {
            path: ['date'],
            message: 'Date is invalid.'
          }
        ])
      }

      return Either.right({
        eventId,
        dayNumber,
        dateMs
      })
    },
    [eventId]
  )

  const dayCreateForm = useForm({
    defaultValues: dayDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(EventDayCreateInputSchema, buildEventDayInput, {
        fieldNameMap: {
          dateMs: 'date'
        }
      })
    },
    onSubmit: ({ value, formApi }) => {
      setDayCreateError(null)
      const input = buildEventDayInput(value)
      if (Either.isLeft(input)) {
        return
      }

      return window.api.eventDaysCreate(input.right).then(
        (result) => {
          if (result._tag === 'Ok') {
            setDayCreateOpen(false)
            formApi.reset(dayDefaults)
            void refreshEventDetail(eventId)
            return
          }

          setDayCreateError(result.error.message)
        },
        (reason) => setDayCreateError(String(reason))
      )
    }
  })

  const attendeeDefaults: AttendeeFormValues = {
    personId: '',
    registrationMode: event?.registrationMode ?? 'PRE_REGISTRATION',
    registeredAt: '',
    registeredBy: '',
    registeredForDayId: '',
    notes: '',
    isCancelled: false,
    attendanceOverrideStatus: '',
    attendanceOverrideNote: ''
  }

  const buildAttendeeInput = useCallback(
    (
      values: AttendeeFormValues
    ): Either.Either<EventAttendeeCreateInput, ReadonlyArray<SchemaIssue>> => {
      const registeredAtMs = parseDateTimeLocalMs(values.registeredAt)
      if (values.registeredAt.trim().length > 0 && registeredAtMs === null) {
        return Either.left([
          {
            path: ['registeredAt'],
            message: 'Registered at is invalid.'
          }
        ])
      }

      const attendanceOverrideStatus =
        values.attendanceOverrideStatus === 'attended' ||
        values.attendanceOverrideStatus === 'not_attended'
          ? values.attendanceOverrideStatus
          : null

      return Either.right({
        eventId,
        personId: values.personId,
        registrationMode: values.registrationMode,
        registeredAtMs,
        registeredBy: trimToNull(values.registeredBy),
        registeredForDayId: trimToNull(values.registeredForDayId),
        notes: trimToNull(values.notes),
        isCancelled: values.isCancelled,
        attendanceOverrideStatus,
        attendanceOverrideNote: trimToNull(values.attendanceOverrideNote)
      })
    },
    [eventId]
  )

  const buildAttendeeUpdateInput = useCallback(
    (
      values: AttendeeFormValues,
      attendeeId: string
    ): Either.Either<EventAttendeeUpdateInput, ReadonlyArray<SchemaIssue>> => {
      const base = buildAttendeeInput(values)
      if (Either.isLeft(base)) {
        return Either.left(base.left)
      }

      return Either.right({
        id: attendeeId,
        ...base.right
      })
    },
    [buildAttendeeInput]
  )

  const attendeeCreateForm = useForm({
    defaultValues: attendeeDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(
        EventAttendeeCreateInputSchema,
        buildAttendeeInput,
        {
          fieldNameMap: {
            registeredAtMs: 'registeredAt',
            registeredBy: 'registeredBy',
            registeredForDayId: 'registeredForDayId',
            attendanceOverrideStatus: 'attendanceOverrideStatus',
            attendanceOverrideNote: 'attendanceOverrideNote'
          }
        }
      )
    },
    onSubmit: ({ value, formApi }) => {
      setAttendeeCreateError(null)
      const input = buildAttendeeInput(value)
      if (Either.isLeft(input)) {
        return
      }

      return window.api.eventAttendeesCreate(input.right).then(
        (result) => {
          if (result._tag === 'Ok') {
            setAttendeeCreateOpen(false)
            formApi.reset(attendeeDefaults)
            void refreshEventDetail(eventId)
            return
          }

          setAttendeeCreateError(result.error.message)
        },
        (reason) => setAttendeeCreateError(String(reason))
      )
    }
  })

  const attendeeEditForm = useForm({
    defaultValues: attendeeDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(
        EventAttendeeUpdateInputSchema,
        (values: AttendeeFormValues) => {
          if (!attendeeEditTarget) {
            return Either.left([
              {
                path: ['personId'],
                message: 'Select an attendee to edit.'
              }
            ])
          }

          return buildAttendeeUpdateInput(values, attendeeEditTarget.id)
        },
        {
          fieldNameMap: {
            registeredAtMs: 'registeredAt',
            registeredBy: 'registeredBy',
            registeredForDayId: 'registeredForDayId',
            attendanceOverrideStatus: 'attendanceOverrideStatus',
            attendanceOverrideNote: 'attendanceOverrideNote'
          }
        }
      )
    },
    onSubmit: ({ value, formApi }) => {
      if (!attendeeEditTarget) {
        return
      }

      setAttendeeEditError(null)
      const input = buildAttendeeUpdateInput(value, attendeeEditTarget.id)
      if (Either.isLeft(input)) {
        return
      }

      return window.api.eventAttendeesUpdate(input.right).then(
        (result) => {
          if (result._tag === 'Ok') {
            setAttendeeEditOpen(false)
            setAttendeeEditTarget(null)
            formApi.reset(attendeeDefaults)
            void refreshEventDetail(eventId)
            return
          }

          setAttendeeEditError(result.error.message)
        },
        (reason) => setAttendeeEditError(String(reason))
      )
    }
  })

  const refresh = useCallback((): void => {
    void refreshEventDetail(eventId)
  }, [eventId])

  const deleteDay = useCallback(
    (dayId: string): void => {
      window.api.eventDaysDelete({ id: dayId }).then(
        (result) => {
          if (result._tag === 'Ok') {
            refresh()
            return
          }
          eventDetailStore.updateSnapshot((current) => ({
            ...current,
            error: result.error.message
          }))
        },
        (reason) =>
          eventDetailStore.updateSnapshot((current) => ({
            ...current,
            error: String(reason)
          }))
      )
    },
    [refresh]
  )

  const openAttendeeEdit = useCallback(
    (attendee: EventAttendee): void => {
      setAttendeeEditTarget(attendee)
      setAttendeeEditOpen(true)
      setAttendeeEditError(null)
      attendeeEditForm.reset({
        personId: attendee.personId,
        registrationMode: attendee.registrationMode,
        registeredAt: formatDateTimeLocalInput(attendee.registeredAtMs),
        registeredBy: attendee.registeredBy ?? '',
        registeredForDayId: attendee.registeredForDayId ?? '',
        notes: attendee.notes ?? '',
        isCancelled: attendee.isCancelled,
        attendanceOverrideStatus: attendee.attendanceOverrideStatus ?? '',
        attendanceOverrideNote: attendee.attendanceOverrideNote ?? ''
      })
    },
    [attendeeEditForm]
  )

  const deleteAttendee = useCallback(
    (attendeeId: string): void => {
      window.api.eventAttendeesDelete({ id: attendeeId }).then(
        (result) => {
          if (result._tag === 'Ok') {
            refresh()
            return
          }
          eventDetailStore.updateSnapshot((current) => ({
            ...current,
            error: result.error.message
          }))
        },
        (reason) =>
          eventDetailStore.updateSnapshot((current) => ({
            ...current,
            error: String(reason)
          }))
      )
    },
    [refresh]
  )

  const toggleAttendance = useCallback(
    (attendeeId: string, dayId: string): void => {
      const key = makeAttendanceKey(attendeeId, dayId)
      const existing = attendanceMap.get(key)
      const nowMs = Date.now()

      if (!existing) {
        window.api
          .attendanceCreate({
            eventAttendeeId: attendeeId,
            eventDayId: dayId,
            status: 'present',
            checkedInAtMs: nowMs,
            checkedInBy: null
          })
          .then(
            (result) => {
              if (result._tag === 'Ok') {
                refresh()
                return
              }
              eventDetailStore.updateSnapshot((current) => ({
                ...current,
                error: result.error.message
              }))
            },
            (reason) =>
              eventDetailStore.updateSnapshot((current) => ({
                ...current,
                error: String(reason)
              }))
          )
        return
      }

      const nextStatus = existing.status === 'present' ? 'absent' : 'present'
      window.api
        .attendanceUpdate({
          id: existing.id,
          eventAttendeeId: attendeeId,
          eventDayId: dayId,
          status: nextStatus,
          checkedInAtMs: nextStatus === 'present' ? nowMs : null,
          checkedInBy: nextStatus === 'present' ? existing.checkedInBy : null
        })
        .then(
          (result) => {
            if (result._tag === 'Ok') {
              refresh()
              return
            }
            eventDetailStore.updateSnapshot((current) => ({
              ...current,
              error: result.error.message
            }))
          },
          (reason) =>
            eventDetailStore.updateSnapshot((current) => ({
              ...current,
              error: String(reason)
            }))
        )
    },
    [attendanceMap, refresh]
  )

  if (!event) {
    return (
      <PageContainer>
        <PageHeader
          icon={<CalendarDays className="h-5 w-5" />}
          title="Event Details"
          description="Loading event information..."
          actions={
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Events
            </Button>
          }
        />
        {detail.error ? (
          <Alert variant="destructive">
            <AlertDescription>{detail.error}</AlertDescription>
          </Alert>
        ) : null}
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title={event.name}
        description={event.description ?? 'Event detail view.'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={detail.loading}>
              <RefreshCw className={detail.loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              {detail.loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Events
            </Button>
          </div>
        }
      />

      {detail.error ? (
        <Alert variant="destructive">
          <AlertDescription>{detail.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={event.status === 'ACTIVE' ? 'default' : event.status === 'CLOSED' ? 'secondary' : 'outline'}>
              {event.status}
            </Badge>
            <p className="text-sm text-muted-foreground">Registration: {event.registrationMode}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Starts: {formatDateTime(event.startsAtMs)}</p>
            <p>Ends: {event.endsAtMs ? formatDateTime(event.endsAtMs) : '—'}</p>
            <p>Days: {days.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Parent event: {event.parentEventId ?? '—'}</p>
            <p>Empowerment: {event.empowermentId ?? '—'}</p>
            <p>Guru: {event.guruId ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Event Days</CardTitle>
            <Dialog
              open={dayCreateOpen}
              onOpenChange={(open) => {
                setDayCreateOpen(open)
                if (!open) {
                  setDayCreateError(null)
                  dayCreateForm.reset(dayDefaults)
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add day
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Event Day</DialogTitle>
                  <DialogDescription>Create an additional day for this event.</DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void dayCreateForm.handleSubmit()
                  }}
                >
                  <div className="grid gap-4 py-4">
                    <dayCreateForm.Field name="dayNumber">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={field.name}>Day number</Label>
                          <Input
                            id={field.name}
                            type="number"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            min={1}
                          />
                          <FormFieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </dayCreateForm.Field>

                    <dayCreateForm.Field name="date">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={field.name}>Date</Label>
                          <Input
                            id={field.name}
                            type="date"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                          />
                          <FormFieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </dayCreateForm.Field>

                    {dayCreateError ? (
                      <Alert variant="destructive">
                        <AlertDescription>{dayCreateError}</AlertDescription>
                      </Alert>
                    ) : null}
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDayCreateOpen(false)}>
                      Cancel
                    </Button>
                    <dayCreateForm.Subscribe
                      selector={(state) => ({
                        canSubmit: state.canSubmit,
                        isSubmitting: state.isSubmitting
                      })}
                    >
                      {({ canSubmit, isSubmitting }) => (
                        <Button type="submit" disabled={!canSubmit}>
                          {isSubmitting ? 'Saving...' : 'Create day'}
                        </Button>
                      )}
                    </dayCreateForm.Subscribe>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={eventDayColumns(deleteDay)}
              rows={days}
              loading={detail.loading}
              getRowKey={(day) => day.id}
              emptyState={
                <EmptyState
                  icon={<CalendarDays className="h-6 w-6" />}
                  title="No event days"
                  description="Add a day to start tracking attendance."
                />
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Attendees</CardTitle>
            <Dialog
              open={attendeeCreateOpen}
              onOpenChange={(open) => {
                setAttendeeCreateOpen(open)
                if (!open) {
                  setAttendeeCreateError(null)
                  attendeeCreateForm.reset(attendeeDefaults)
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add attendee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Attendee</DialogTitle>
                  <DialogDescription>Add a person to this event.</DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void attendeeCreateForm.handleSubmit()
                  }}
                >
                  <div className="grid gap-4 py-4">
                    <attendeeCreateForm.Field name="personId">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={field.name}>Person</Label>
                          <select
                            id={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="">Select a person</option>
                            {peopleOptions.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.label}
                              </option>
                            ))}
                          </select>
                          <FormFieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </attendeeCreateForm.Field>

                    <div className="grid grid-cols-2 gap-4">
                      <attendeeCreateForm.Field name="registrationMode">
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
                      </attendeeCreateForm.Field>

                      <attendeeCreateForm.Field name="registeredAt">
                        {(field) => (
                          <div className="grid gap-2">
                            <Label htmlFor={field.name}>Registered at</Label>
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
                      </attendeeCreateForm.Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <attendeeCreateForm.Field name="registeredBy">
                        {(field) => (
                          <div className="grid gap-2">
                            <Label htmlFor={field.name}>Registered by</Label>
                            <Input
                              id={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.target.value)}
                              placeholder="Staff name"
                            />
                            <FormFieldError errors={field.state.meta.errors} />
                          </div>
                        )}
                      </attendeeCreateForm.Field>

                      <attendeeCreateForm.Field name="registeredForDayId">
                        {(field) => (
                          <div className="grid gap-2">
                            <Label htmlFor={field.name}>Registered for day</Label>
                            <select
                              id={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.target.value)}
                              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="">None</option>
                              {days.map((day) => (
                                <option key={day.id} value={day.id}>
                                  Day {day.dayNumber}
                                </option>
                              ))}
                            </select>
                            <FormFieldError errors={field.state.meta.errors} />
                          </div>
                        )}
                      </attendeeCreateForm.Field>
                    </div>

                    <attendeeCreateForm.Field name="notes">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={field.name}>Notes</Label>
                          <Textarea
                            id={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            placeholder="Optional notes"
                            rows={3}
                          />
                          <FormFieldError errors={field.state.meta.errors} />
                        </div>
                      )}
                    </attendeeCreateForm.Field>

                    <div className="grid grid-cols-2 gap-4">
                      <attendeeCreateForm.Field name="attendanceOverrideStatus">
                        {(field) => (
                          <div className="grid gap-2">
                            <Label htmlFor={field.name}>Attendance override</Label>
                            <select
                              id={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(
                                  event.target.value === 'attended'
                                    ? 'attended'
                                    : event.target.value === 'not_attended'
                                      ? 'not_attended'
                                      : ''
                                )
                              }
                              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="">None</option>
                              <option value="attended">Attended</option>
                              <option value="not_attended">Not attended</option>
                            </select>
                            <FormFieldError errors={field.state.meta.errors} />
                          </div>
                        )}
                      </attendeeCreateForm.Field>

                      <attendeeCreateForm.Field name="attendanceOverrideNote">
                        {(field) => (
                          <div className="grid gap-2">
                            <Label htmlFor={field.name}>Override note</Label>
                            <Input
                              id={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.target.value)}
                              placeholder="Reason for override"
                            />
                            <FormFieldError errors={field.state.meta.errors} />
                          </div>
                        )}
                      </attendeeCreateForm.Field>
                    </div>

                    <attendeeCreateForm.Field name="isCancelled">
                      {(field) => (
                        <div className="flex items-center gap-2">
                          <input
                            id={field.name}
                            type="checkbox"
                            checked={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.checked)}
                          />
                          <Label htmlFor={field.name}>Cancelled</Label>
                        </div>
                      )}
                    </attendeeCreateForm.Field>

                    {attendeeCreateError ? (
                      <Alert variant="destructive">
                        <AlertDescription>{attendeeCreateError}</AlertDescription>
                      </Alert>
                    ) : null}
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAttendeeCreateOpen(false)}>
                      Cancel
                    </Button>
                    <attendeeCreateForm.Subscribe
                      selector={(state) => ({
                        canSubmit: state.canSubmit,
                        isSubmitting: state.isSubmitting
                      })}
                    >
                      {({ canSubmit, isSubmitting }) => (
                        <Button type="submit" disabled={!canSubmit}>
                          {isSubmitting ? 'Saving...' : 'Add attendee'}
                        </Button>
                      )}
                    </attendeeCreateForm.Subscribe>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={attendeeColumns(openAttendeeEdit, deleteAttendee)}
              rows={attendeeRows}
              loading={detail.loading}
              getRowKey={(row) => row.attendee.id}
              emptyState={
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title="No attendees yet"
                  description="Add attendees to track registration and attendance."
                />
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {days.length === 0 || attendeeRows.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="No attendance to track"
              description="Add event days and attendees to start tracking attendance."
            />
          ) : (
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Attendee</TableHead>
                    {days.map((day) => (
                      <TableHead key={day.id} className="text-center">
                        Day {day.dayNumber}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendeeRows.map((row) => (
                    <TableRow key={row.attendee.id}>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">
                            {row.person ? getFullName(row.person) : row.attendee.personId}
                          </p>
                          <p className="text-muted-foreground">{row.attendee.registrationMode}</p>
                        </div>
                      </TableCell>
                      {days.map((day) => {
                        const record = attendanceMap.get(
                          makeAttendanceKey(row.attendee.id, day.id)
                        )
                        const present = record?.status === 'present'
                        return (
                          <TableCell key={day.id} className="text-center">
                            <Button
                              size="sm"
                              variant={present ? 'default' : 'outline'}
                              onClick={() => toggleAttendance(row.attendee.id, day.id)}
                            >
                              {present ? 'Present' : 'Absent'}
                            </Button>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={attendeeEditOpen}
        onOpenChange={(open) => {
          setAttendeeEditOpen(open)
          if (!open) {
            setAttendeeEditTarget(null)
            setAttendeeEditError(null)
            attendeeEditForm.reset(attendeeDefaults)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendee</DialogTitle>
            <DialogDescription>Update attendee details.</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void attendeeEditForm.handleSubmit()
            }}
          >
            <div className="grid gap-4 py-4">
              <attendeeEditForm.Field name="personId">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Person</Label>
                    <select
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Select a person</option>
                      {peopleOptions.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                    <FormFieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </attendeeEditForm.Field>

              <div className="grid grid-cols-2 gap-4">
                <attendeeEditForm.Field name="registrationMode">
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
                </attendeeEditForm.Field>

                <attendeeEditForm.Field name="registeredAt">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Registered at</Label>
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
                </attendeeEditForm.Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <attendeeEditForm.Field name="registeredBy">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Registered by</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </attendeeEditForm.Field>

                <attendeeEditForm.Field name="registeredForDayId">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Registered for day</Label>
                      <select
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">None</option>
                        {days.map((day) => (
                          <option key={day.id} value={day.id}>
                            Day {day.dayNumber}
                          </option>
                        ))}
                      </select>
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </attendeeEditForm.Field>
              </div>

              <attendeeEditForm.Field name="notes">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Notes</Label>
                    <Textarea
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      rows={3}
                    />
                    <FormFieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </attendeeEditForm.Field>

              <div className="grid grid-cols-2 gap-4">
                <attendeeEditForm.Field name="attendanceOverrideStatus">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Attendance override</Label>
                      <select
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.value === 'attended'
                              ? 'attended'
                              : event.target.value === 'not_attended'
                                ? 'not_attended'
                                : ''
                          )
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">None</option>
                        <option value="attended">Attended</option>
                        <option value="not_attended">Not attended</option>
                      </select>
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </attendeeEditForm.Field>

                <attendeeEditForm.Field name="attendanceOverrideNote">
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={field.name}>Override note</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      <FormFieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </attendeeEditForm.Field>
              </div>

              <attendeeEditForm.Field name="isCancelled">
                {(field) => (
                  <div className="flex items-center gap-2">
                    <input
                      id={field.name}
                      type="checkbox"
                      checked={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.checked)}
                    />
                    <Label htmlFor={field.name}>Cancelled</Label>
                  </div>
                )}
              </attendeeEditForm.Field>

              {attendeeEditError ? (
                <Alert variant="destructive">
                  <AlertDescription>{attendeeEditError}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAttendeeEditOpen(false)}>
                Cancel
              </Button>
              <attendeeEditForm.Subscribe
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
              </attendeeEditForm.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
