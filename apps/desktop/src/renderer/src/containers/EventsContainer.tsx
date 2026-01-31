import { useCallback, useMemo, useState, useSyncExternalStore } from "react"
import { Either, Schema } from "effect"
import { EventsPage } from "../components/pages/EventsPage"
import { EventCreateInputSchema, type Event } from "@satori/shared/domain/event"
import { formatParseIssues } from "@satori/shared/utils/parseIssue"
import type { SchemaIssue } from "@satori/shared/ipc/contract"
import { toErrorCause } from "@satori/shared/utils/errorCause"
import { createStore } from "../utils/store"

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

type EventsListState = {
  readonly events: ReadonlyArray<Event>
  readonly loading: boolean
  readonly error: string | null
}

const eventsListStore = createStore<EventsListState>({
  events: [],
  loading: false,
  error: null,
})

let eventsListStarted = false
let eventsListRequestId = 0

const refreshEventsList = (query: string | undefined): Promise<void> => {
  eventsListRequestId += 1
  const requestId = eventsListRequestId

  eventsListStore.updateSnapshot((current) => ({
    ...current,
    loading: true,
    error: null,
  }))

  return window.api.eventsList({ query }).then(
    (result) => {
      if (eventsListRequestId !== requestId) {
        return
      }

      if (result._tag === "Ok") {
        eventsListStore.setSnapshot({
          events: result.value,
          loading: false,
          error: null,
        })
        return
      }

      eventsListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: result.error.message,
      }))
    },
    (reason) => {
      if (eventsListRequestId !== requestId) {
        return
      }

      eventsListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: toErrorCause(reason).message,
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

  const [query, setQuery] = useState("")
  const normalizedQuery = useMemo(() => normalizeQuery(query), [query])

  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createStartsAt, setCreateStartsAt] = useState("")
  const [createEndsAt, setCreateEndsAt] = useState("")
  const [createIssues, setCreateIssues] = useState<ReadonlyArray<SchemaIssue>>([])
  const [createError, setCreateError] = useState<string | null>(null)

  const refresh = useCallback((): void => {
    void refreshEventsList(normalizedQuery)
  }, [normalizedQuery])

  const cancelCreate = useCallback((): void => {
    setCreateOpen(false)
    setCreateIssues([])
    setCreateError(null)
  }, [])

  const submitCreate = useCallback((): void => {
    setCreateError(null)

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
      (reason) => setCreateError(toErrorCause(reason).message)
    )
  }, [createDescription, createEndsAt, createStartsAt, createTitle, refresh])

  const deleteEvent = useCallback(
    (id: string): void => {
      window.api.eventsDelete({ id }).then(
        (result) => {
          if (result._tag === "Ok") {
            refresh()
            return
          }
          eventsListStore.updateSnapshot((current) => ({
            ...current,
            error: result.error.message,
          }))
        },
        (reason) =>
          eventsListStore.updateSnapshot((current) => ({
            ...current,
            error: toErrorCause(reason).message,
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
      events={events}
      onQueryChange={setQuery}
      onRefresh={refresh}
      onDelete={deleteEvent}
      create={{
        open: createOpen,
        title: createTitle,
        description: createDescription,
        startsAt: createStartsAt,
        endsAt: createEndsAt,
        issues: createIssues,
        error: createError,
        onOpenChange: (open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateIssues([])
            setCreateError(null)
          }
        },
        onTitleChange: setCreateTitle,
        onDescriptionChange: setCreateDescription,
        onStartsAtChange: setCreateStartsAt,
        onEndsAtChange: setCreateEndsAt,
        onCancel: cancelCreate,
        onSubmit: submitCreate,
      }}
    />
  )
}
