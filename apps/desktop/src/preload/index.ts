import { contextBridge, ipcRenderer } from 'electron'
import { Cause, Effect, Exit, Option, ParseResult, Schema } from 'effect'
import {
  IpcResultSchema,
  IpcRoutes,
  makeErr,
  type IpcApi,
  type IpcResult
} from '@satori/ipc-contract/ipc/contract'
import { formatParseIssues } from '@satori/ipc-contract/utils/parseIssue'

class IpcInvokeError extends Schema.TaggedError<IpcInvokeError>('IpcInvokeError')(
  'IpcInvokeError',
  {
    message: Schema.String,
    channel: Schema.String,
    cause: Schema.Unknown
  }
) {}

class ContextBridgeExposeError extends Schema.TaggedError<ContextBridgeExposeError>(
  'ContextBridgeExposeError'
)('ContextBridgeExposeError', {
  message: Schema.String,
  cause: Schema.Unknown
}) {}

const invokeRoute = async <Request, RequestEncoded, Response, ResponseEncoded>(
  route: {
    readonly channel: string
    readonly request: Schema.Schema<Request, RequestEncoded, never>
    readonly response: Schema.Schema<Response, ResponseEncoded, never>
  },
  payload: Request
): Promise<IpcResult<Response>> => {
  const encodedPayloadExit = await Effect.runPromiseExit(Schema.encode(route.request)(payload))

  if (Exit.isFailure(encodedPayloadExit)) {
    return makeErr({
      _tag: 'Defect',
      message: Cause.pretty(encodedPayloadExit.cause)
    })
  }

  const rawResultExit = await Effect.runPromiseExit(
    Effect.tryPromise({
      try: () => ipcRenderer.invoke(route.channel, encodedPayloadExit.value),
      catch: (cause) =>
        new IpcInvokeError({
          message: 'Failed to invoke IPC route',
          channel: route.channel,
          cause
        })
    })
  )

  if (Exit.isFailure(rawResultExit)) {
    const failure = Cause.failureOption(rawResultExit.cause)
    const message = Option.match(failure, {
      onNone: () => Cause.pretty(rawResultExit.cause),
      onSome: (error) => error.message
    })

    return makeErr({
      _tag: 'Defect',
      message
    })
  }

  const resultExit = await Effect.runPromiseExit(
    Schema.decodeUnknown(IpcResultSchema(route.response))(rawResultExit.value)
  )

  if (Exit.isSuccess(resultExit)) {
    return resultExit.value
  }

  const parseError = Cause.failureOption(resultExit.cause)
  if (parseError._tag === 'Some' && ParseResult.isParseError(parseError.value)) {
    return makeErr({
      _tag: 'ResponseDecodeError',
      message: 'Invalid IPC response',
      issues: formatParseIssues(parseError.value)
    })
  }

  return makeErr({
    _tag: 'Defect',
    message: Cause.pretty(resultExit.cause)
  })
}

const api: IpcApi = {
  ping: () => invokeRoute(IpcRoutes.ping, undefined),
  echo: (payload) => invokeRoute(IpcRoutes.echo, payload),
  authStatus: () => invokeRoute(IpcRoutes.authStatus, undefined),
  authSignIn: (payload) => invokeRoute(IpcRoutes.authSignIn, payload),
  authSignOut: () => invokeRoute(IpcRoutes.authSignOut, undefined),
  eventsList: (payload) => invokeRoute(IpcRoutes.eventsList, payload),
  eventsCreate: (payload) => invokeRoute(IpcRoutes.eventsCreate, payload),
  eventsUpdate: (payload) => invokeRoute(IpcRoutes.eventsUpdate, payload),
  eventsDelete: (payload) => invokeRoute(IpcRoutes.eventsDelete, payload),
  eventDaysList: (payload) => invokeRoute(IpcRoutes.eventDaysList, payload),
  eventDaysCreate: (payload) => invokeRoute(IpcRoutes.eventDaysCreate, payload),
  eventDaysUpdate: (payload) => invokeRoute(IpcRoutes.eventDaysUpdate, payload),
  eventDaysDelete: (payload) => invokeRoute(IpcRoutes.eventDaysDelete, payload),
  eventAttendeesList: (payload) => invokeRoute(IpcRoutes.eventAttendeesList, payload),
  eventAttendeesCreate: (payload) => invokeRoute(IpcRoutes.eventAttendeesCreate, payload),
  eventAttendeesUpdate: (payload) => invokeRoute(IpcRoutes.eventAttendeesUpdate, payload),
  eventAttendeesDelete: (payload) => invokeRoute(IpcRoutes.eventAttendeesDelete, payload),
  personsList: (payload) => invokeRoute(IpcRoutes.personsList, payload),
  personsCreate: (payload) => invokeRoute(IpcRoutes.personsCreate, payload),
  personsUpdate: (payload) => invokeRoute(IpcRoutes.personsUpdate, payload),
  personsDelete: (payload) => invokeRoute(IpcRoutes.personsDelete, payload),
  attendanceList: (payload) => invokeRoute(IpcRoutes.attendanceList, payload),
  attendanceCreate: (payload) => invokeRoute(IpcRoutes.attendanceCreate, payload),
  attendanceUpdate: (payload) => invokeRoute(IpcRoutes.attendanceUpdate, payload),
  attendanceDelete: (payload) => invokeRoute(IpcRoutes.attendanceDelete, payload),
  groupsList: (payload) => invokeRoute(IpcRoutes.groupsList, payload),
  groupsCreate: (payload) => invokeRoute(IpcRoutes.groupsCreate, payload),
  groupsUpdate: (payload) => invokeRoute(IpcRoutes.groupsUpdate, payload),
  groupsDelete: (payload) => invokeRoute(IpcRoutes.groupsDelete, payload),
  personGroupsList: (payload) => invokeRoute(IpcRoutes.personGroupsList, payload),
  personGroupsCreate: (payload) => invokeRoute(IpcRoutes.personGroupsCreate, payload),
  personGroupsUpdate: (payload) => invokeRoute(IpcRoutes.personGroupsUpdate, payload),
  personGroupsDelete: (payload) => invokeRoute(IpcRoutes.personGroupsDelete, payload),
  empowermentsList: (payload) => invokeRoute(IpcRoutes.empowermentsList, payload),
  empowermentsCreate: (payload) => invokeRoute(IpcRoutes.empowermentsCreate, payload),
  empowermentsUpdate: (payload) => invokeRoute(IpcRoutes.empowermentsUpdate, payload),
  empowermentsDelete: (payload) => invokeRoute(IpcRoutes.empowermentsDelete, payload),
  gurusList: (payload) => invokeRoute(IpcRoutes.gurusList, payload),
  gurusCreate: (payload) => invokeRoute(IpcRoutes.gurusCreate, payload),
  gurusUpdate: (payload) => invokeRoute(IpcRoutes.gurusUpdate, payload),
  gurusDelete: (payload) => invokeRoute(IpcRoutes.gurusDelete, payload),
  mahakramaStepsList: (payload) => invokeRoute(IpcRoutes.mahakramaStepsList, payload),
  mahakramaStepsCreate: (payload) => invokeRoute(IpcRoutes.mahakramaStepsCreate, payload),
  mahakramaStepsUpdate: (payload) => invokeRoute(IpcRoutes.mahakramaStepsUpdate, payload),
  mahakramaStepsDelete: (payload) => invokeRoute(IpcRoutes.mahakramaStepsDelete, payload),
  mahakramaHistoryList: (payload) => invokeRoute(IpcRoutes.mahakramaHistoryList, payload),
  mahakramaHistoryCreate: (payload) => invokeRoute(IpcRoutes.mahakramaHistoryCreate, payload),
  mahakramaHistoryUpdate: (payload) => invokeRoute(IpcRoutes.mahakramaHistoryUpdate, payload),
  mahakramaHistoryDelete: (payload) => invokeRoute(IpcRoutes.mahakramaHistoryDelete, payload),
  photosCreate: (payload) => invokeRoute(IpcRoutes.photosCreate, payload),
  photosDelete: (payload) => invokeRoute(IpcRoutes.photosDelete, payload),
  photosGet: (payload) => invokeRoute(IpcRoutes.photosGet, payload),
  syncNow: () => invokeRoute(IpcRoutes.syncNow, undefined),
  syncStatus: () => invokeRoute(IpcRoutes.syncStatus, undefined)
}

const versions = {
  electron: process.versions.electron ?? '',
  chrome: process.versions.chrome ?? '',
  node: process.versions.node ?? ''
} as const

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  const exit = Effect.runSyncExit(
    Effect.try({
      try: () => {
        contextBridge.exposeInMainWorld('versions', versions)
        contextBridge.exposeInMainWorld('api', api)
      },
      catch: (cause) =>
        new ContextBridgeExposeError({
          message: 'Failed to expose preload APIs',
          cause
        })
    })
  )

  if (Exit.isFailure(exit)) {
    console.error(Cause.pretty(exit.cause))
  }
} else {
  const globalWindow = globalThis as typeof globalThis & {
    versions: typeof versions
    api: IpcApi
  }

  globalWindow.versions = versions
  globalWindow.api = api
}
