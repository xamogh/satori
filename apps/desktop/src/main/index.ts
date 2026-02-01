import { app, BrowserWindow, session, shell } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { Effect, Layer, Exit, Cause, Option } from 'effect'
import { join } from 'node:path'
import { APP_USER_MODEL_ID } from './constants/window'
import { WindowService } from './services/WindowService'
import { IpcService } from './services/IpcService'
import { registerAppProtocolHandler, registerAppProtocolPrivileges } from './utils/appProtocol'
import {
  getAllowedRendererOrigins,
  isAllowedRendererUrl,
  isSafeOpenExternalUrl
} from './utils/security'

app.enableSandbox()
registerAppProtocolPrivileges()

const MainLive = Layer.mergeAll(WindowService.Default, IpcService.Default)

const initializeApp = Effect.gen(function* () {
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeOpenExternalUrl(url)) {
        setImmediate(() => {
          void shell.openExternal(url).catch((error) => {
            console.error('Failed to open external URL:', url, error)
          })
        })
      }

      return { action: 'deny' }
    })

    contents.on('will-navigate', (event, navigationUrl) => {
      if (!isAllowedRendererUrl(navigationUrl)) {
        event.preventDefault()
      }
    })

    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const allowedOrigins = getAllowedRendererOrigins()
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl =
        'requestingUrl' in details ? details.requestingUrl : webContents.getURL()

      const isAllowedOrigin =
        typeof requestingUrl === 'string' && isAllowedRendererUrl(requestingUrl)

      callback(isAllowedOrigin && permission === 'fullscreen')
    }
  )

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) =>
      allowedOrigins.includes(requestingOrigin) && permission === 'fullscreen'
  )

  yield* Effect.sync(() => {
    registerAppProtocolHandler(join(__dirname, '../renderer'))
  })

  const ipcService = yield* IpcService
  yield* ipcService.registerHandlers

  const windowService = yield* WindowService
  yield* windowService.createMainWindow

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      Effect.runPromise(windowService.createMainWindow.pipe(Effect.provide(MainLive)))
    }
  })
})

const program = initializeApp.pipe(Effect.provide(MainLive))

app.whenReady().then(() => {
  Effect.runPromiseExit(program).then((exit) => {
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      if (Option.isSome(failure)) {
        console.error('Application failed to initialize:', failure.value)
      } else {
        console.error('Application failed to initialize:', Cause.pretty(exit.cause))
      }
      app.quit()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
