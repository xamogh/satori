import { Effect } from "effect"
import { IpcCommunicationError, IpcRemoteError } from "../errors"
import {
  IpcRoutes,
  type AuthSignInRequest,
  type AuthState,
  type IpcRequest,
  type IpcResponse,
} from "@satori/ipc-contract/ipc/contract"

const makeIpcClientService = Effect.sync(() => {
  const authStatus: Effect.Effect<AuthState, IpcCommunicationError | IpcRemoteError> = Effect.tryPromise({
    try: async () => {
      const result = await window.api.authStatus()
      if (result._tag === "Ok") {
        return result.value
      }

      throw new IpcRemoteError({
        message: result.error.message,
        error: result.error,
      })
    },
    catch: (error) =>
      error instanceof IpcRemoteError
        ? error
        : new IpcCommunicationError({
            message: "Failed to invoke IPC route: authStatus",
            channel: IpcRoutes.authStatus.channel,
            cause: error,
          }),
  })

  const authSignIn = (
    payload: AuthSignInRequest
  ): Effect.Effect<AuthState, IpcCommunicationError | IpcRemoteError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await window.api.authSignIn(payload)
        if (result._tag === "Ok") {
          return result.value
        }

        throw new IpcRemoteError({
          message: result.error.message,
          error: result.error,
        })
      },
      catch: (error) =>
        error instanceof IpcRemoteError
          ? error
          : new IpcCommunicationError({
              message: "Failed to invoke IPC route: authSignIn",
              channel: IpcRoutes.authSignIn.channel,
              cause: error,
            }),
    })

  const authSignOut: Effect.Effect<AuthState, IpcCommunicationError | IpcRemoteError> = Effect.tryPromise({
    try: async () => {
      const result = await window.api.authSignOut()
      if (result._tag === "Ok") {
        return result.value
      }

      throw new IpcRemoteError({
        message: result.error.message,
        error: result.error,
      })
    },
    catch: (error) =>
      error instanceof IpcRemoteError
        ? error
        : new IpcCommunicationError({
            message: "Failed to invoke IPC route: authSignOut",
            channel: IpcRoutes.authSignOut.channel,
            cause: error,
          }),
  })

  const ping: Effect.Effect<IpcResponse<"ping">, IpcCommunicationError | IpcRemoteError> = Effect.tryPromise({
    try: async () => {
      const result = await window.api.ping()
      if (result._tag === "Ok") {
        return result.value
      }

      throw new IpcRemoteError({
        message: result.error.message,
        error: result.error,
      })
    },
    catch: (error) =>
      error instanceof IpcRemoteError
        ? error
        : new IpcCommunicationError({
            message: "Failed to invoke IPC route: ping",
            channel: IpcRoutes.ping.channel,
            cause: error,
          }),
  })

  const echo = (
    payload: IpcRequest<"echo">
  ): Effect.Effect<IpcResponse<"echo">, IpcCommunicationError | IpcRemoteError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await window.api.echo(payload)
        if (result._tag === "Ok") {
          return result.value
        }

        throw new IpcRemoteError({
          message: result.error.message,
          error: result.error,
        })
      },
      catch: (error) =>
        error instanceof IpcRemoteError
          ? error
          : new IpcCommunicationError({
              message: "Failed to invoke IPC route: echo",
              channel: IpcRoutes.echo.channel,
              cause: error,
            }),
    })

  return { authStatus, authSignIn, authSignOut, ping, echo } as const
})

export class IpcClientService extends Effect.Service<IpcClientService>()("services/IpcClientService", {
  dependencies: [],
  effect: makeIpcClientService,
}) {}
