import { useCallback, useEffect, useState } from "react"
import { Effect } from "effect"
import { IpcClientService, IpcClientServiceLive } from "../services/IpcClientService"
import type { AuthSignInRequest, AuthState } from "@satori/ipc-contract/ipc/contract"

export type AuthViewState = { readonly _tag: "Loading" } | AuthState

export type UseAuthResult = {
  readonly authState: AuthViewState
  readonly signIn: (request: AuthSignInRequest) => Promise<AuthState>
  readonly signOut: () => Promise<AuthState>
  readonly refreshStatus: () => Promise<AuthState>
}

const loadingState: AuthViewState = { _tag: "Loading" }

const lockFromAuthenticated = (
  state: Extract<AuthState, { _tag: "Authenticated" }>
): Extract<AuthState, { _tag: "Locked" }> => ({
  _tag: "Locked",
  reason: "TokenExpired",
  email: state.email,
})

export const useAuth = (): UseAuthResult => {
  const [authState, setAuthState] = useState<AuthViewState>(loadingState)

  const refreshStatus = useCallback((): Promise<AuthState> => {
    const program = Effect.gen(function* () {
      const ipcService = yield* IpcClientService
      return yield* ipcService.authStatus
    }).pipe(Effect.provide(IpcClientServiceLive))

    const promise = Effect.runPromise(program)
    promise.then(setAuthState, () => setAuthState({ _tag: "Unauthenticated" }))
    return promise
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (authState._tag !== "Authenticated") {
      return
    }

    const timeoutMs = authState.expiresAtMs - Date.now()
    if (timeoutMs <= 0) {
      setAuthState(lockFromAuthenticated(authState))
      return
    }

    const id = window.setTimeout(() => {
      setAuthState(lockFromAuthenticated(authState))
    }, timeoutMs)

    return () => window.clearTimeout(id)
  }, [authState])

  const signIn = useCallback((request: AuthSignInRequest): Promise<AuthState> => {
    const program = Effect.gen(function* () {
      const ipcService = yield* IpcClientService
      return yield* ipcService.authSignIn(request)
    }).pipe(Effect.provide(IpcClientServiceLive))

    const promise = Effect.runPromise(program)
    promise.then(setAuthState)
    return promise
  }, [])

  const signOut = useCallback((): Promise<AuthState> => {
    const program = Effect.gen(function* () {
      const ipcService = yield* IpcClientService
      return yield* ipcService.authSignOut
    }).pipe(Effect.provide(IpcClientServiceLive))

    const promise = Effect.runPromise(program)
    promise.then(setAuthState)
    return promise
  }, [])

  return { authState, signIn, signOut, refreshStatus }
}
