import { useCallback, useMemo, useState, useSyncExternalStore } from "react"
import { Either, Schema } from "effect"
import { EventsPage } from "../components/pages/EventsPage"
import { EventCreateInputSchema, type Event } from "@satori/domain/domain/event"
import { formatParseIssues } from "@satori/ipc-contract/utils/parseIssue"
import type { SchemaIssue } from "@satori/ipc-contract/ipc/contract"
import { createStore } from "../utils/store"
import { clampPageIndex, slicePage } from "../utils/pagination"

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
        error: String(reason),
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
  const [createName, setCreateName] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createStartsAt, setCreateStartsAt] = useState("")
  const [createEndsAt, setCreateEndsAt] = useState("")
  const [createRegistrationMode, setCreateRegistrationMode] = useState<
    "PRE_REGISTRATION" | "WALK_IN"
  >("PRE_REGISTRATION")
  const [createIssues, setCreateIssues] = useState<ReadonlyArray<SchemaIssue>>([])
  const [createError, setCreateError] = useState<string | null>(null)

  const refresh = useCallback((): void => {
    setPageIndex(0)
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
      parentEventId: null,
      name: createName,
      description: createDescription.trim().length === 0 ? null : createDescription,
      registrationMode: createRegistrationMode,
      status: "DRAFT",
      startsAtMs,
      endsAtMs,
      empowermentId: null,
      guruId: null,
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
          setCreateName("")
          setCreateDescription("")
          setCreateStartsAt("")
          setCreateEndsAt("")
          setCreateRegistrationMode("PRE_REGISTRATION")
          refresh()
          return
        }

        setCreateError(result.error.message)
      },
      (reason) => setCreateError(String(reason))
    )
  }, [
    createDescription,
    createEndsAt,
    createStartsAt,
    createName,
    createRegistrationMode,
    refresh,
  ])

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
            error: String(reason),
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
        name: createName,
        description: createDescription,
        startsAt: createStartsAt,
        endsAt: createEndsAt,
        registrationMode: createRegistrationMode,
        issues: createIssues,
        error: createError,
        onOpenChange: (open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateIssues([])
            setCreateError(null)
          }
        },
        onNameChange: setCreateName,
        onDescriptionChange: setCreateDescription,
        onStartsAtChange: setCreateStartsAt,
        onEndsAtChange: setCreateEndsAt,
        onRegistrationModeChange: setCreateRegistrationMode,
        onCancel: cancelCreate,
        onSubmit: submitCreate,
      }}
    />
  )
}
