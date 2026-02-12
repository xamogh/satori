import { createStore } from '../utils/store'
import type {
  AuthMode,
  AuthModeStatus,
  AuthState,
  IpcResult,
  LocalAuthCredentials
} from '@satori/ipc-contract/ipc/contract'

export type AppModeViewState = { readonly _tag: 'Loading' } | AuthModeStatus

const loadingState: AppModeViewState = { _tag: 'Loading' }

const modeStore = createStore<AppModeViewState>(loadingState)

let started = false

const setModeState = (state: AuthModeStatus): void => {
  modeStore.setSnapshot(state)
}

const refresh = (): Promise<AppModeViewState> =>
  window.api.authModeStatus().then((result) => {
    if (result._tag === 'Ok') {
      setModeState(result.value)
      return result.value
    }

    const fallback: AppModeViewState = { _tag: 'Unconfigured' }
    modeStore.setSnapshot(fallback)
    return fallback
  })

const subscribe = (listener: () => void): (() => void) => {
  if (!started) {
    started = true
    void refresh()
  }

  return modeStore.subscribe(listener)
}

const selectMode = (mode: AuthMode): Promise<IpcResult<AuthModeStatus>> =>
  window.api.authSelectMode(mode).then((result) => {
    if (result._tag === 'Ok') {
      setModeState(result.value)
    }

    return result
  })

const localOnboard = (payload: LocalAuthCredentials): Promise<IpcResult<AuthState>> =>
  window.api.authLocalOnboard(payload).then((result) => {
    if (result._tag === 'Ok') {
      setModeState({
        _tag: 'ConfiguredLocal',
        mode: 'local',
        localAccountExists: true
      })
    }

    return result
  })

export const AppModeStore = {
  subscribe,
  getSnapshot: modeStore.getSnapshot,
  refresh,
  selectMode,
  localOnboard
} as const
