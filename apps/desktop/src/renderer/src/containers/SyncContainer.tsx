import { useCallback, useSyncExternalStore } from "react"
import type { SyncStatus } from "@satori/domain/sync/schemas"
import { SyncPage } from "../components/pages/SyncPage"
import { createStore } from "../utils/store"

type SyncState = {
  readonly status: SyncStatus | null
  readonly loading: boolean
  readonly error: string | null
}

const syncStore = createStore<SyncState>({
  status: null,
  loading: false,
  error: null,
})

let syncStarted = false
let syncRequestId = 0

const refreshSyncState = (mode: "status" | "now"): Promise<void> => {
  syncRequestId += 1
  const requestId = syncRequestId

  syncStore.updateSnapshot((current) => ({ ...current, loading: true, error: null }))

  const action = mode === "now" ? window.api.syncNow() : window.api.syncStatus()

  return action
    .then(
      (result) => {
        if (syncRequestId !== requestId) {
          return
        }

        if (result._tag === "Ok") {
          syncStore.setSnapshot({
            status: result.value,
            loading: false,
            error: null,
          })
          return
        }

        syncStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: result.error.message,
        }))
      },
      (reason) => {
        if (syncRequestId !== requestId) {
          return
        }

        syncStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: String(reason),
        }))
      }
    )
    .finally(() => {
      if (syncRequestId !== requestId) {
        return
      }

      syncStore.updateSnapshot((current) => ({ ...current, loading: false }))
    })
}

const subscribeSync = (listener: () => void): (() => void) => {
  if (!syncStarted) {
    syncStarted = true
    void refreshSyncState("status")
  }

  return syncStore.subscribe(listener)
}

export const SyncContainer = (): React.JSX.Element => {
  const { status, loading, error } = useSyncExternalStore(
    subscribeSync,
    syncStore.getSnapshot,
    syncStore.getSnapshot
  )

  const refresh = useCallback((): void => {
    void refreshSyncState("status")
  }, [])

  const syncNow = useCallback((): void => {
    void refreshSyncState("now")
  }, [])

  return (
    <SyncPage status={status} loading={loading} error={error} onRefresh={refresh} onSyncNow={syncNow} />
  )
}
