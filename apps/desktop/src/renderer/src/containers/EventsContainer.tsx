import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useForm } from '@tanstack/react-form'
import { Either } from 'effect'
import { EventsPage, type EventsCreateFormValues } from '../components/pages/EventsPage'
import {
  EventCreateInputSchema,
  type Event,
  type EventCreateInput
} from '@satori/domain/domain/event'
import type { SchemaIssue } from '@satori/ipc-contract/ipc/contract'
import { createStore } from '../utils/store'
import { clampPageIndex, slicePage } from '../utils/pagination'
import { createSchemaFormValidator } from '../utils/formValidation'
import { parseDateTimeLocalMs } from '../utils/date'
import { trimToNull } from '../utils/string'

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

let eventsListStarted = false
let eventsListRequestId = 0

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

  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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
        parentEventId: null,
        name: values.name,
        description: trimToNull(values.description),
        registrationMode: values.registrationMode,
        status: 'DRAFT',
        startsAtMs,
        endsAtMs,
        empowermentId: null,
        guruId: null
      })
    },
    []
  )

  const eventCreateDefaults: EventsCreateFormValues = {
    name: '',
    description: '',
    startsAt: '',
    endsAt: '',
    registrationMode: 'PRE_REGISTRATION'
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

  const cancelCreate = useCallback((): void => {
    setCreateOpen(false)
    setCreateError(null)
    eventCreateForm.reset()
  }, [eventCreateForm])

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
      onDelete={deleteEvent}
      create={{
        open: createOpen,
        form: eventCreateForm,
        error: createError,
        onOpenChange: (open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateError(null)
            eventCreateForm.reset()
          }
        },
        onCancel: cancelCreate
      }}
    />
  )
}
