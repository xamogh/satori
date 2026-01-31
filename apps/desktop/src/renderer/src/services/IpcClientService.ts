import { Effect } from "effect"
import { IpcCommunicationError, IpcRemoteError } from "../errors"
import {
  IpcRoutes,
  type AuthSignInRequest,
  type AuthState,
  type IpcRequest,
  type IpcResponse,
  type IpcResult,
} from "@satori/ipc-contract/ipc/contract"

const makeIpcClientService = Effect.sync(() => {
  const handleResult = <A>(
    route: keyof typeof IpcRoutes,
    result: IpcResult<A>
  ): Effect.Effect<A, IpcRemoteError> =>
    result._tag === "Ok"
      ? Effect.succeed(result.value)
      : Effect.fail(
          new IpcRemoteError({
            message: `IPC route ${route} failed: ${result.error.message}`,
            error: result.error,
          })
        )

  const invokeVoid = <K extends keyof typeof IpcRoutes>(
    route: K,
    call: () => Promise<IpcResult<IpcResponse<K>>>
  ): Effect.Effect<IpcResponse<K>, IpcCommunicationError | IpcRemoteError> =>
    Effect.tryPromise({
      try: call,
      catch: (cause) =>
        new IpcCommunicationError({
          message: `Failed to invoke IPC route: ${route}`,
          channel: IpcRoutes[route].channel,
          cause,
        }),
    }).pipe(Effect.flatMap((result) => handleResult(route, result)))

  const invokePayload = <K extends keyof typeof IpcRoutes>(
    route: K,
    payload: IpcRequest<K>,
    call: (payload: IpcRequest<K>) => Promise<IpcResult<IpcResponse<K>>>
  ): Effect.Effect<IpcResponse<K>, IpcCommunicationError | IpcRemoteError> =>
    Effect.tryPromise({
      try: () => call(payload),
      catch: (cause) =>
        new IpcCommunicationError({
          message: `Failed to invoke IPC route: ${route}`,
          channel: IpcRoutes[route].channel,
          cause,
        }),
    }).pipe(Effect.flatMap((result) => handleResult(route, result)))

  const authStatus = invokeVoid("authStatus", () => window.api.authStatus())

  const authSignIn = (
    payload: AuthSignInRequest
  ): Effect.Effect<AuthState, IpcCommunicationError | IpcRemoteError> =>
    invokePayload("authSignIn", payload, (input) => window.api.authSignIn(input))

  const authSignOut = invokeVoid("authSignOut", () => window.api.authSignOut())

  const ping = invokeVoid("ping", () => window.api.ping())

  const echo = (
    payload: IpcRequest<"echo">
  ): Effect.Effect<IpcResponse<"echo">, IpcCommunicationError | IpcRemoteError> =>
    invokePayload("echo", payload, (input) => window.api.echo(input))

  return { authStatus, authSignIn, authSignOut, ping, echo } as const
})

export class IpcClientService extends Effect.Service<IpcClientService>()("services/IpcClientService", {
  dependencies: [],
  effect: makeIpcClientService,
}) {}
