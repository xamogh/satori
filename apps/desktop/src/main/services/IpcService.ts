import { ipcMain } from "electron"
import { Cause, Effect, Exit, Option, ParseResult, Schema } from "effect"
import { IpcError } from "../errors"
import { isAllowedRendererUrl } from "../utils/security"
import {
  IpcRoutes,
  makeErr,
  makeOk,
} from "@satori/ipc-contract/ipc/contract"
import { formatParseIssues } from "@satori/ipc-contract/utils/parseIssue"
import { AuthService } from "./AuthService"
import { DataService } from "./DataService"
import { SyncService } from "./SyncService"

const registerHandler = <
  Request,
  RequestEncoded,
  Response,
  ResponseEncoded,
  HandlerError extends { readonly _tag: string; readonly message: string } & Error,
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
          event,
          payload: RequestEncoded
        ) => {
          const senderFrameUrl = event.senderFrame?.url ?? null
          if (senderFrameUrl === null || !isAllowedRendererUrl(senderFrameUrl)) {
            return makeErr({
              _tag: "Unauthorized",
              message: "Unauthorized",
            })
          }

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
                switch (failure.value._tag) {
                  case "UnauthorizedError":
                    return makeErr({
                      _tag: "Unauthorized",
                      message: failure.value.message,
                    })
                  case "LockedError":
                    return makeErr({
                      _tag: "Locked",
                      message: failure.value.message,
                    })
                  default:
                    return makeErr({
                      _tag: "HandlerError",
                      message: failure.value.message,
                    })
                }
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
      registerHandler(IpcRoutes.eventDaysList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventDaysList(query))
        )
      ),
      registerHandler(IpcRoutes.eventDaysCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventDaysCreate(input))
        )
      ),
      registerHandler(IpcRoutes.eventDaysUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventDaysUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.eventDaysDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventDaysDelete(input))
        )
      ),
      registerHandler(IpcRoutes.eventAttendeesList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventAttendeesList(query))
        )
      ),
      registerHandler(IpcRoutes.eventAttendeesCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventAttendeesCreate(input))
        )
      ),
      registerHandler(IpcRoutes.eventAttendeesUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventAttendeesUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.eventAttendeesDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.eventAttendeesDelete(input))
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
      registerHandler(IpcRoutes.groupsList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.groupsList(query))
        )
      ),
      registerHandler(IpcRoutes.groupsCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.groupsCreate(input))
        )
      ),
      registerHandler(IpcRoutes.groupsUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.groupsUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.groupsDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.groupsDelete(input))
        )
      ),
      registerHandler(IpcRoutes.personGroupsList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.personGroupsList(query))
        )
      ),
      registerHandler(IpcRoutes.personGroupsCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.personGroupsCreate(input))
        )
      ),
      registerHandler(IpcRoutes.personGroupsUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.personGroupsUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.personGroupsDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.personGroupsDelete(input))
        )
      ),
      registerHandler(IpcRoutes.empowermentsList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.empowermentsList(query))
        )
      ),
      registerHandler(IpcRoutes.empowermentsCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.empowermentsCreate(input))
        )
      ),
      registerHandler(IpcRoutes.empowermentsUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.empowermentsUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.empowermentsDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.empowermentsDelete(input))
        )
      ),
      registerHandler(IpcRoutes.gurusList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.gurusList(query))
        )
      ),
      registerHandler(IpcRoutes.gurusCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.gurusCreate(input))
        )
      ),
      registerHandler(IpcRoutes.gurusUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.gurusUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.gurusDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.gurusDelete(input))
        )
      ),
      registerHandler(IpcRoutes.mahakramaStepsList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.mahakramaStepsList(query))
        )
      ),
      registerHandler(IpcRoutes.mahakramaStepsCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.mahakramaStepsCreate(input))
        )
      ),
      registerHandler(IpcRoutes.mahakramaStepsUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.mahakramaStepsUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.mahakramaStepsDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.mahakramaStepsDelete(input))
        )
      ),
      registerHandler(IpcRoutes.mahakramaHistoryList, (query) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.mahakramaHistoryList(query))
        )
      ),
      registerHandler(IpcRoutes.mahakramaHistoryCreate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.mahakramaHistoryCreate(input))
        )
      ),
      registerHandler(IpcRoutes.mahakramaHistoryUpdate, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.mahakramaHistoryUpdate(input))
        )
      ),
      registerHandler(IpcRoutes.mahakramaHistoryDelete, (input) =>
        authService.requireAuthenticated.pipe(
          Effect.zipRight(dataService.mahakramaHistoryDelete(input))
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
  } as const
})

export class IpcService extends Effect.Service<IpcService>()("services/IpcService", {
  dependencies: [AuthService.Default, DataService.Default, SyncService.Default],
  effect: makeIpcService,
}) {}
