import { Effect, Context, Layer } from "effect"
import { IpcCommunicationError, IpcRemoteError } from "../errors"
import {
  IpcRoutes,
  type AuthSignInRequest,
  type AuthState,
  type IpcRequest,
  type IpcResponse,
} from "@satori/shared/ipc/contract"
import { toErrorCause } from "@satori/shared/utils/errorCause"

export class IpcClientService extends Context.Tag("IpcClientService")<
  IpcClientService,
  {
    readonly authStatus: Effect.Effect<
      AuthState,
      IpcCommunicationError | IpcRemoteError
    >
    readonly authSignIn: (
      payload: AuthSignInRequest
    ) => Effect.Effect<AuthState, IpcCommunicationError | IpcRemoteError>
    readonly authSignOut: Effect.Effect<
      AuthState,
      IpcCommunicationError | IpcRemoteError
    >

    readonly ping: Effect.Effect<
      IpcResponse<"ping">,
      IpcCommunicationError | IpcRemoteError
    >
    readonly echo: (
      payload: IpcRequest<"echo">
    ) => Effect.Effect<IpcResponse<"echo">, IpcCommunicationError | IpcRemoteError>
  }
>() {}

const makeIpcClientService = Effect.sync(() => ({
  authStatus: Effect.tryPromise({
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
            cause: toErrorCause(error),
          }),
  }),

  authSignIn: (payload) =>
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
              cause: toErrorCause(error),
            }),
    }),

  authSignOut: Effect.tryPromise({
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
            cause: toErrorCause(error),
          }),
  }),

  ping: Effect.tryPromise({
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
            cause: toErrorCause(error),
          }),
  }),

  echo: (payload) =>
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
              cause: toErrorCause(error),
            }),
    }),
}))

export const IpcClientServiceLive = Layer.effect(
  IpcClientService,
  makeIpcClientService
)
