import { useCallback, useSyncExternalStore } from "react"
import { OverviewPage, type OverviewStats } from "../components/pages/OverviewPage"
import { createStore } from "../utils/store"

type OverviewState = {
  readonly loading: boolean
  readonly error: string | null
  readonly stats: OverviewStats | null
}

const overviewStore = createStore<OverviewState>({
  loading: false,
  error: null,
  stats: null,
})

let overviewStarted = false
let overviewRequestId = 0

const refreshOverview = (): Promise<void> => {
  overviewRequestId += 1
  const requestId = overviewRequestId

  overviewStore.updateSnapshot((current) => ({ ...current, loading: true, error: null }))

  return Promise.all([window.api.eventsList({}), window.api.personsList({}), window.api.syncStatus()])
    .then(
      ([eventsResult, peopleResult, syncResult]) => {
        if (overviewRequestId !== requestId) {
          return
        }

        if (eventsResult._tag !== "Ok") {
          overviewStore.updateSnapshot((current) => ({
            ...current,
            loading: false,
            error: eventsResult.error.message,
          }))
          return
        }

        if (peopleResult._tag !== "Ok") {
          overviewStore.updateSnapshot((current) => ({
            ...current,
            loading: false,
            error: peopleResult.error.message,
          }))
          return
        }

        if (syncResult._tag !== "Ok") {
          overviewStore.updateSnapshot((current) => ({
            ...current,
            loading: false,
            error: syncResult.error.message,
          }))
          return
        }

        overviewStore.setSnapshot({
          loading: false,
          error: null,
          stats: {
            eventsCount: eventsResult.value.length,
            peopleCount: peopleResult.value.length,
            pendingOutboxCount: syncResult.value.pendingOutboxCount,
            lastAttemptAtMs: syncResult.value.lastAttemptAtMs,
            lastSuccessAtMs: syncResult.value.lastSuccessAtMs,
            lastError: syncResult.value.lastError,
            recentEvents: eventsResult.value.slice(0, 8),
          },
        })
      },
      (reason) => {
        if (overviewRequestId !== requestId) {
          return
        }

        overviewStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: reason instanceof Error ? reason.message : String(reason),
        }))
      }
    )
    .finally(() => {
      if (overviewRequestId !== requestId) {
        return
      }

      overviewStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
      }))
    })
}

const subscribeOverview = (listener: () => void): (() => void) => {
  if (!overviewStarted) {
    overviewStarted = true
    void refreshOverview()
  }

  return overviewStore.subscribe(listener)
}

export const OverviewContainer = (): React.JSX.Element => {
  const refresh = useCallback((): void => {
    void refreshOverview()
  }, [])

  const { loading, error, stats } = useSyncExternalStore(
    subscribeOverview,
    overviewStore.getSnapshot,
    overviewStore.getSnapshot
  )

  return <OverviewPage loading={loading} error={error} stats={stats} onRefresh={refresh} />
}
