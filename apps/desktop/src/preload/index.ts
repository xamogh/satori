import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Cause, Effect, Exit, Option, ParseResult, Schema } from 'effect'
import { IpcResultSchema, IpcRoutes, makeErr, type IpcApi, type IpcResult } from '@satori/ipc-contract/ipc/contract'
import { formatParseIssues } from '@satori/ipc-contract/utils/parseIssue'

const invokeRoute = async <Request, RequestEncoded, Response, ResponseEncoded>(
  route: {
    readonly channel: string
    readonly request: Schema.Schema<Request, RequestEncoded, never>
    readonly response: Schema.Schema<Response, ResponseEncoded, never>
  },
  payload: Request
): Promise<IpcResult<Response>> => {
  const encodedPayloadExit = await Effect.runPromiseExit(
    Schema.encode(route.request)(payload)
  )

  if (Exit.isFailure(encodedPayloadExit)) {
    return makeErr({
      _tag: 'Defect',
      message: Cause.pretty(encodedPayloadExit.cause),
    })
  }

  const rawResultExit = await Effect.runPromiseExit(
    Effect.tryPromise({
      try: () => ipcRenderer.invoke(route.channel, encodedPayloadExit.value),
      catch: (cause) => cause,
    })
  )

  if (Exit.isFailure(rawResultExit)) {
    const failure = Cause.failureOption(rawResultExit.cause)
    const message = Option.match(failure, {
      onNone: () => Cause.pretty(rawResultExit.cause),
      onSome: (cause) => (cause instanceof Error ? cause.message : String(cause)),
    })

    return makeErr({
      _tag: 'Defect',
      message,
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
      issues: formatParseIssues(parseError.value),
    })
  }

  return makeErr({
    _tag: 'Defect',
    message: Cause.pretty(resultExit.cause),
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
  personsList: (payload) => invokeRoute(IpcRoutes.personsList, payload),
  personsCreate: (payload) => invokeRoute(IpcRoutes.personsCreate, payload),
  personsUpdate: (payload) => invokeRoute(IpcRoutes.personsUpdate, payload),
  personsDelete: (payload) => invokeRoute(IpcRoutes.personsDelete, payload),
  registrationsList: (payload) => invokeRoute(IpcRoutes.registrationsList, payload),
  registrationsCreate: (payload) => invokeRoute(IpcRoutes.registrationsCreate, payload),
  registrationsUpdate: (payload) => invokeRoute(IpcRoutes.registrationsUpdate, payload),
  registrationsDelete: (payload) => invokeRoute(IpcRoutes.registrationsDelete, payload),
  attendanceList: (payload) => invokeRoute(IpcRoutes.attendanceList, payload),
  attendanceCreate: (payload) => invokeRoute(IpcRoutes.attendanceCreate, payload),
  attendanceUpdate: (payload) => invokeRoute(IpcRoutes.attendanceUpdate, payload),
  attendanceDelete: (payload) => invokeRoute(IpcRoutes.attendanceDelete, payload),
  photosCreate: (payload) => invokeRoute(IpcRoutes.photosCreate, payload),
  photosDelete: (payload) => invokeRoute(IpcRoutes.photosDelete, payload),
  photosGet: (payload) => invokeRoute(IpcRoutes.photosGet, payload),
  syncNow: () => invokeRoute(IpcRoutes.syncNow, undefined),
  syncStatus: () => invokeRoute(IpcRoutes.syncStatus, undefined),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  const exit = Effect.runSyncExit(
    Effect.try({
      try: () => {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
      },
      catch: (cause) => cause,
    })
  )

  if (Exit.isFailure(exit)) {
    console.error(Cause.pretty(exit.cause))
  }
} else {
  const globalWindow = globalThis as typeof globalThis & {
    electron: typeof electronAPI
    api: IpcApi
  }

  globalWindow.electron = electronAPI
  globalWindow.api = api
}
