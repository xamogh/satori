import { createStore } from "../utils/store"
import type { AuthSignInRequest, AuthState, IpcResult } from "@satori/ipc-contract/ipc/contract"

export type AuthViewState = { readonly _tag: "Loading" } | AuthState

const loadingState: AuthViewState = { _tag: "Loading" }

const lockFromAuthenticated = (
  state: Extract<AuthState, { _tag: "Authenticated" }>
): Extract<AuthState, { _tag: "Locked" }> => ({
  _tag: "Locked",
  reason: "TokenExpired",
  email: state.email,
})

const authStore = createStore<AuthViewState>(loadingState)

let started = false
let tokenTimeoutId: number | null = null

const clearTokenTimeout = (): void => {
  if (tokenTimeoutId === null) {
    return
  }

  window.clearTimeout(tokenTimeoutId)
  tokenTimeoutId = null
}

const setAuthState = (state: AuthViewState): void => {
  clearTokenTimeout()

  if (state._tag === "Authenticated") {
    const timeoutMs = state.expiresAtMs - Date.now()
    if (timeoutMs <= 0) {
      authStore.setSnapshot(lockFromAuthenticated(state))
      return
    }

    tokenTimeoutId = window.setTimeout(() => {
      tokenTimeoutId = null
      authStore.setSnapshot(lockFromAuthenticated(state))
    }, timeoutMs)
  }

  authStore.setSnapshot(state)
}

const refresh = (): Promise<AuthViewState> =>
  window.api.authStatus().then((result) => {
    if (result._tag === "Ok") {
      setAuthState(result.value)
      return result.value
    }

    const next: AuthViewState = { _tag: "Unauthenticated" }
    setAuthState(next)
    return next
  })

const subscribe = (listener: () => void): (() => void) => {
  if (!started) {
    started = true
    void refresh()
  }

  return authStore.subscribe(listener)
}

const signIn = (payload: AuthSignInRequest): Promise<IpcResult<AuthState>> =>
  window.api.authSignIn(payload).then((result) => {
    if (result._tag === "Ok") {
      setAuthState(result.value)
    }

    return result
  })

const signOut = (): Promise<IpcResult<AuthState>> =>
  window.api.authSignOut().then((result) => {
    if (result._tag === "Ok") {
      setAuthState(result.value)
    }

    return result
  })

export const AuthStore = {
  subscribe,
  getSnapshot: authStore.getSnapshot,
  refresh,
  signIn,
  signOut,
} as const
