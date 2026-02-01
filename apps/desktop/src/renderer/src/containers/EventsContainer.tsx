import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useForm } from '@tanstack/react-form'
import { Either } from 'effect'
import {
  EventsPage,
  type EventsCreateFormValues,
  type EventsFormOptions
} from '../components/pages/EventsPage'
import {
  EventCreateInputSchema,
  EventUpdateInputSchema,
  type Event,
  type EventCreateInput,
  type EventUpdateInput
} from '@satori/domain/domain/event'
import type { Empowerment } from '@satori/domain/domain/empowerment'
import type { Guru } from '@satori/domain/domain/guru'
import type { SchemaIssue } from '@satori/ipc-contract/ipc/contract'
import { createStore } from '../utils/store'
import { clampPageIndex, slicePage } from '../utils/pagination'
import { createSchemaFormValidator } from '../utils/formValidation'
import { formatDateTimeLocalInput, parseDateTimeLocalMs } from '../utils/date'
import { trimToNull } from '../utils/string'
import { EventDetailContainer } from './EventDetailContainer'

const normalizeQuery = (raw: string): string | undefined => {
  const trimmed = raw.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

type EventsListState = {
  readonly events: ReadonlyArray<Event>
  readonly loading: boolean
  readonly error: string | null
}

const eventsListStore = createStore<EventsListState>({
  events: [],
  loading: false,
  error: null
})

type EventFormOptionsState = {
  readonly empowerments: ReadonlyArray<Empowerment>
  readonly gurus: ReadonlyArray<Guru>
  readonly loading: boolean
  readonly error: string | null
}

const eventFormOptionsStore = createStore<EventFormOptionsState>({
  empowerments: [],
  gurus: [],
  loading: false,
  error: null
})

let eventsListStarted = false
let eventsListRequestId = 0
let eventFormOptionsRequestId = 0

const refreshEventsList = (query: string | undefined): Promise<void> => {
  eventsListRequestId += 1
  const requestId = eventsListRequestId

  eventsListStore.updateSnapshot((current) => ({
    ...current,
    loading: true,
    error: null
  }))

  return window.api.eventsList({ query }).then(
    (result) => {
      if (eventsListRequestId !== requestId) {
        return
      }

      if (result._tag === 'Ok') {
        eventsListStore.setSnapshot({
          events: result.value,
          loading: false,
          error: null
        })
        return
      }

      eventsListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: result.error.message
      }))
    },
    (reason) => {
      if (eventsListRequestId !== requestId) {
        return
      }

      eventsListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: String(reason)
      }))
    }
  )
}

const refreshEventFormOptions = (): Promise<void> => {
  eventFormOptionsRequestId += 1
  const requestId = eventFormOptionsRequestId

  eventFormOptionsStore.updateSnapshot((current) => ({
    ...current,
    loading: true,
    error: null
  }))

  return Promise.all([
    window.api.empowermentsList({ query: undefined }),
    window.api.gurusList({ query: undefined })
  ]).then(
    ([empowermentsResult, gurusResult]) => {
      if (eventFormOptionsRequestId !== requestId) {
        return
      }

      if (empowermentsResult._tag !== 'Ok') {
        eventFormOptionsStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: empowermentsResult.error.message
        }))
        return
      }

      if (gurusResult._tag !== 'Ok') {
        eventFormOptionsStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: gurusResult.error.message
        }))
        return
      }

      eventFormOptionsStore.setSnapshot({
        empowerments: empowermentsResult.value,
        gurus: gurusResult.value,
        loading: false,
        error: null
      })
    },
    (reason) => {
      if (eventFormOptionsRequestId !== requestId) {
        return
      }

      eventFormOptionsStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: String(reason)
      }))
    }
  )
}

const subscribeEventsList = (listener: () => void): (() => void) => {
  if (!eventsListStarted) {
    eventsListStarted = true
    void refreshEventsList(undefined)
  }

  return eventsListStore.subscribe(listener)
}

export const EventsContainer = (): React.JSX.Element => {
  const { events, loading, error } = useSyncExternalStore(
    subscribeEventsList,
    eventsListStore.getSnapshot,
    eventsListStore.getSnapshot
  )
  const formOptionsState = useSyncExternalStore(
    eventFormOptionsStore.subscribe,
    eventFormOptionsStore.getSnapshot,
    eventFormOptionsStore.getSnapshot
  )

  const [query, setQuery] = useState('')
  const normalizedQuery = useMemo(() => normalizeQuery(query), [query])

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const safePageIndex = useMemo(
    () => clampPageIndex(pageIndex, events.length, pageSize),
    [events.length, pageIndex, pageSize]
  )

  const pagedEvents = useMemo(
    () => slicePage(events, safePageIndex, pageSize),
    [events, pageSize, safePageIndex]
  )

  const parentOptions = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        label: event.name
      })),
    [events]
  )

  const empowermentOptions = useMemo(
    () =>
      formOptionsState.empowerments.map((empowerment) => ({
        id: empowerment.id,
        label: empowerment.name
      })),
    [formOptionsState.empowerments]
  )

  const guruOptions = useMemo(
    () =>
      formOptionsState.gurus.map((guru) => ({
        id: guru.id,
        label: guru.name
      })),
    [formOptionsState.gurus]
  )

  const formOptions: EventsFormOptions = useMemo(
    () => ({
      parents: parentOptions,
      empowerments: empowermentOptions,
      gurus: guruOptions,
      loading: formOptionsState.loading,
      error: formOptionsState.error
    }),
    [
      empowermentOptions,
      formOptionsState.error,
      formOptionsState.loading,
      guruOptions,
      parentOptions
    ]
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const refresh = useCallback((): void => {
    setPageIndex(0)
    void refreshEventsList(normalizedQuery)
  }, [normalizedQuery])

  const buildEventCreateInput = useCallback(
    (values: EventsCreateFormValues): Either.Either<EventCreateInput, ReadonlyArray<SchemaIssue>> => {
      const startsAtMs = parseDateTimeLocalMs(values.startsAt)
      if (startsAtMs === null) {
        return Either.left([
          {
            path: ['startsAt'],
            message: 'Start date/time is required.'
          }
        ])
      }

      const endsAtMs = parseDateTimeLocalMs(values.endsAt)
      if (values.endsAt.trim().length > 0 && endsAtMs === null) {
        return Either.left([
          {
            path: ['endsAt'],
            message: 'End date/time is invalid.'
          }
        ])
      }

      return Either.right({
        parentEventId: trimToNull(values.parentEventId),
        name: values.name,
        description: trimToNull(values.description),
        registrationMode: values.registrationMode,
        status: values.status,
        startsAtMs,
        endsAtMs,
        empowermentId: trimToNull(values.empowermentId),
        guruId: trimToNull(values.guruId)
      })
    },
    []
  )

  const buildEventUpdateInput = useCallback(
    (
      values: EventsCreateFormValues,
      eventId: string
    ): Either.Either<EventUpdateInput, ReadonlyArray<SchemaIssue>> => {
      const base = buildEventCreateInput(values)
      if (Either.isLeft(base)) {
        return Either.left(base.left)
      }

      if (base.right.parentEventId === eventId) {
        return Either.left([
          {
            path: ['parentEventId'],
            message: 'Parent event cannot reference itself.'
          }
        ])
      }

      return Either.right({
        id: eventId,
        ...base.right
      })
    },
    [buildEventCreateInput]
  )

  const toEventFormValues = useCallback(
    (event: Event): EventsCreateFormValues => ({
      name: event.name,
      description: event.description ?? '',
      startsAt: formatDateTimeLocalInput(event.startsAtMs),
      endsAt: formatDateTimeLocalInput(event.endsAtMs),
      registrationMode: event.registrationMode,
      status: event.status,
      parentEventId: event.parentEventId ?? '',
      empowermentId: event.empowermentId ?? '',
      guruId: event.guruId ?? ''
    }),
    []
  )

  const eventCreateDefaults: EventsCreateFormValues = {
    name: '',
    description: '',
    startsAt: '',
    endsAt: '',
    registrationMode: 'PRE_REGISTRATION',
    status: 'DRAFT',
    parentEventId: '',
    empowermentId: '',
    guruId: ''
  }

  const eventCreateForm = useForm({
    defaultValues: eventCreateDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(EventCreateInputSchema, buildEventCreateInput, {
        fieldNameMap: {
          startsAtMs: 'startsAt',
          endsAtMs: 'endsAt'
        }
      })
    },
    onSubmit: ({ value, formApi }) => {
      setCreateError(null)
      const input = buildEventCreateInput(value)
      if (Either.isLeft(input)) {
        return
      }

      return window.api.eventsCreate(input.right).then(
        (result) => {
          if (result._tag === 'Ok') {
            setCreateOpen(false)
            formApi.reset()
            refresh()
            return
          }

          setCreateError(result.error.message)
        },
        (reason) => setCreateError(String(reason))
      )
    }
  })

  const eventEditForm = useForm({
    defaultValues: eventCreateDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(
        EventUpdateInputSchema,
        (values: EventsCreateFormValues) => {
          if (!editEvent) {
            return Either.left([
              {
                path: ['name'],
                message: 'Select an event to edit.'
              }
            ])
          }

          return buildEventUpdateInput(values, editEvent.id)
        },
        {
          fieldNameMap: {
            startsAtMs: 'startsAt',
            endsAtMs: 'endsAt'
          }
        }
      )
    },
    onSubmit: ({ value, formApi }) => {
      if (!editEvent) {
        return
      }

      setEditError(null)
      const input = buildEventUpdateInput(value, editEvent.id)
      if (Either.isLeft(input)) {
        return
      }

      return window.api.eventsUpdate(input.right).then(
        (result) => {
          if (result._tag === 'Ok') {
            setEditOpen(false)
            setEditEvent(null)
            formApi.reset(eventCreateDefaults)
            refresh()
            return
          }

          setEditError(result.error.message)
        },
        (reason) => setEditError(String(reason))
      )
    }
  })

  const cancelCreate = useCallback((): void => {
    setCreateOpen(false)
    setCreateError(null)
    eventCreateForm.reset()
  }, [eventCreateForm])

  const openEdit = useCallback(
    (event: Event): void => {
      setEditEvent(event)
      setEditOpen(true)
      setEditError(null)
      eventEditForm.reset(toEventFormValues(event))
      void refreshEventFormOptions()
    },
    [eventEditForm, toEventFormValues]
  )

  const cancelEdit = useCallback((): void => {
    setEditOpen(false)
    setEditEvent(null)
    setEditError(null)
    eventEditForm.reset()
  }, [eventEditForm])

  const handleEditOpenChange = useCallback(
    (open: boolean): void => {
      setEditOpen(open)
      if (!open) {
        setEditEvent(null)
        setEditError(null)
        eventEditForm.reset()
      }
    },
    [eventEditForm]
  )

  const viewEvent = useCallback((event: Event): void => {
    setSelectedEventId(event.id)
  }, [])

  const closeEventDetail = useCallback((): void => {
    setSelectedEventId(null)
  }, [])

  const deleteEvent = useCallback(
    (id: string): void => {
      window.api.eventsDelete({ id }).then(
        (result) => {
          if (result._tag === 'Ok') {
            refresh()
            return
          }
          eventsListStore.updateSnapshot((current) => ({
            ...current,
            error: result.error.message
          }))
        },
        (reason) =>
          eventsListStore.updateSnapshot((current) => ({
            ...current,
            error: String(reason)
          }))
      )
    },
    [refresh]
  )

  if (selectedEventId) {
    return <EventDetailContainer eventId={selectedEventId} onBack={closeEventDetail} />
  }

  return (
    <EventsPage
      query={query}
      loading={loading}
      error={error}
      events={pagedEvents}
      eventsTotal={events.length}
      pageIndex={safePageIndex}
      pageSize={pageSize}
      onPageIndexChange={setPageIndex}
      onPageSizeChange={(nextPageSize) => {
        setPageIndex(0)
        setPageSize(nextPageSize)
      }}
      onQueryChange={(value) => {
        setPageIndex(0)
        setQuery(value)
      }}
      onRefresh={refresh}
      onView={viewEvent}
      onEdit={openEdit}
      onDelete={deleteEvent}
      formOptions={formOptions}
      create={{
        open: createOpen,
        form: eventCreateForm,
        error: createError,
        onOpenChange: (open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateError(null)
            eventCreateForm.reset()
            return
          }
          void refreshEventFormOptions()
        },
        onCancel: cancelCreate
      }}
      edit={{
        open: editOpen,
        form: eventEditForm,
        eventName: editEvent?.name ?? null,
        error: editError,
        onOpenChange: handleEditOpenChange,
        onCancel: cancelEdit
      }}
    />
  )
}
