import { ipcMain } from "electron"
import { Cause, Effect, Exit, Context, Layer, Option, ParseResult, Schema } from "effect"
import { IpcError, LockedError, UnauthorizedError } from "../errors"
import {
  IpcRoutes,
  makeErr,
  makeOk,
} from "@satori/ipc-contract/ipc/contract"
import { formatParseIssues } from "@satori/ipc-contract/utils/parseIssue"
import { AuthService } from "./AuthService"
import { DataService } from "./DataService"
import { SyncService } from "./SyncService"

export class IpcService extends Context.Tag("IpcService")<
  IpcService,
  {
    readonly registerHandlers: Effect.Effect<void, IpcError>
    readonly removeHandlers: Effect.Effect<void, never>
  }
>() {}

const registerHandler = <
  Request,
  RequestEncoded,
  Response,
  ResponseEncoded,
  HandlerError extends Error,
>(
  route: {
    readonly channel: string
    readonly request: Schema.Schema<Request, RequestEncoded, never>
    readonly response: Schema.Schema<Response, ResponseEncoded, never>
  },
  handler: (request: Request) => Effect.Effect<Response, HandlerError>
): Effect.Effect<void, IpcError> =>
  Effect.try({
    try: () => {
      ipcMain.removeHandler(route.channel)
      ipcMain.handle(
        route.channel,
        async (
          _event,
          payload: RequestEncoded
        ) => {
          const program = Effect.gen(function* () {
            const requestExit = yield* Effect.exit(
              Schema.decodeUnknown(route.request)(payload)
            )

            if (Exit.isFailure(requestExit)) {
              const parseError = Cause.failureOption(requestExit.cause)
              if (
                Option.isSome(parseError) &&
                ParseResult.isParseError(parseError.value)
              ) {
                return makeErr({
                  _tag: "RequestDecodeError",
                  message: "Invalid IPC request",
                  issues: formatParseIssues(parseError.value),
                })
              }

              return makeErr({
                _tag: "Defect",
                message: Cause.pretty(requestExit.cause),
              })
            }

            const responseExit = yield* Effect.exit(handler(requestExit.value))
            if (Exit.isFailure(responseExit)) {
              const failure = Cause.failureOption(responseExit.cause)
              if (Option.isSome(failure)) {
                if (failure.value instanceof UnauthorizedError) {
                  return makeErr({
                    _tag: "Unauthorized",
                    message: failure.value.message,
                  })
                }

                if (failure.value instanceof LockedError) {
                  return makeErr({
                    _tag: "Locked",
                    message: failure.value.message,
                  })
                }

                return makeErr({
                  _tag: "HandlerError",
                  message: failure.value.message,
                })
              }

              return makeErr({
                _tag: "Defect",
                message: Cause.pretty(responseExit.cause),
              })
            }

            const encodedResponseExit = yield* Effect.exit(
              Schema.encode(route.response)(responseExit.value)
            )
            if (Exit.isFailure(encodedResponseExit)) {
              return makeErr({
                _tag: "Defect",
                message: Cause.pretty(encodedResponseExit.cause),
              })
            }

            return makeOk(encodedResponseExit.value)
          })

          return Effect.runPromise(program)
        }
      )
    },
    catch: (error) =>
      new IpcError({
        message: "Failed to register IPC handler",
        channel: route.channel,
        cause: error,
      }),
  })

const makeIpcService = Effect.gen(function* () {
  const authService = yield* AuthService
  const dataService = yield* DataService
  const syncService = yield* SyncService

  return {
    registerHandlers: Effect.all([
      registerHandler(IpcRoutes.authStatus, () => authService.getStatus),
      registerHandler(IpcRoutes.authSignIn, (request) =>
        authService.signIn(request)
      ),
      registerHandler(IpcRoutes.authSignOut, () => authService.signOut),

      registerHandler(IpcRoutes.ping, () =>
        authService.requireAuthenticated.pipe(
          Effect.tap(() => Effect.sync(() => console.log("pong"))),
          Effect.as("pong" as const)
        )
      ),

      registerHandler(IpcRoutes.echo, ({ message }) =>
        authService.requireAuthenticated.pipe(Effect.as({ message }))
      ),

      registerHandler(IpcRoutes.eventsList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventsList(query))
        )
      ),
      registerHandler(IpcRoutes.eventsCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventsCreate(input))
        )
      ),
      registerHandler(IpcRoutes.eventsUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventsUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.eventsDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventsDelete(input))
        )
      ),

      registerHandler(IpcRoutes.personsList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.personsList(query))
        )
      ),
      registerHandler(IpcRoutes.personsCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.personsCreate(input))
        )
      ),
      registerHandler(IpcRoutes.personsUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.personsUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.personsDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.personsDelete(input))
        )
      ),

      registerHandler(IpcRoutes.registrationsList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.registrationsList(query))
        )
      ),
      registerHandler(IpcRoutes.registrationsCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.registrationsCreate(input))
        )
      ),
      registerHandler(IpcRoutes.registrationsUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.registrationsUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.registrationsDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.registrationsDelete(input))
        )
      ),

      registerHandler(IpcRoutes.attendanceList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.attendanceList(query))
        )
      ),
      registerHandler(IpcRoutes.attendanceCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.attendanceCreate(input))
        )
      ),
      registerHandler(IpcRoutes.attendanceUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.attendanceUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.attendanceDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.attendanceDelete(input))
        )
      ),

      registerHandler(IpcRoutes.photosCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.photosCreate(input))
        )
      ),
      registerHandler(IpcRoutes.photosDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.photosDelete(input))
        )
      ),
      registerHandler(IpcRoutes.photosGet, ({ id }) =>
        authService.requireAuthenticated.pipe(Effect.zipRight(dataService.photosGet(id)))
      ),

      registerHandler(IpcRoutes.syncStatus, () =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(syncService.getStatus)
        )
      ),
      registerHandler(IpcRoutes.syncNow, () =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(syncService.syncNow)
        )
      ),
    ]).pipe(Effect.asVoid),

    removeHandlers: Effect.sync(() => {
      for (const route of Object.values(IpcRoutes)) {
        ipcMain.removeHandler(route.channel)
      }
    }),
  }
})

export const IpcServiceLive = Layer.effect(IpcService, makeIpcService)
