import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { Effect, Option } from 'effect'
import icon from '../../../resources/icon.png?asset'
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT } from '../constants/window'
import { APP_PROTOCOL_ROOT_URL } from '../constants/security'
import { FileLoadError } from '../errors'

const makeWindowService = Effect.sync(() => {
  let mainWindow: BrowserWindow | null = null

  return {
    createMainWindow: Effect.gen(function* () {
      const window = new BrowserWindow({
        width: DEFAULT_WINDOW_WIDTH,
        height: DEFAULT_WINDOW_HEIGHT,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          nodeIntegrationInWorker: false,
          nodeIntegrationInSubFrames: false,
          webviewTag: false
        }
      })

      window.on('ready-to-show', () => {
        window.show()
      })

      yield* loadWindowContent(window)

      mainWindow = window
      return window
    }),

    getMainWindow: Effect.sync(() => Option.fromNullable(mainWindow))
  } as const
})

const loadWindowContent = (window: BrowserWindow): Effect.Effect<void, FileLoadError> =>
  Effect.gen(function* () {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      yield* Effect.tryPromise({
        try: () => window.loadURL(process.env['ELECTRON_RENDERER_URL']!),
        catch: (error) =>
          new FileLoadError({
            message: 'Failed to load development URL',
            path: process.env['ELECTRON_RENDERER_URL']!,
            cause: error
          })
      })
    } else {
      yield* Effect.tryPromise({
        try: () => window.loadURL(APP_PROTOCOL_ROOT_URL),
        catch: (error) =>
          new FileLoadError({
            message: 'Failed to load app protocol URL',
            path: APP_PROTOCOL_ROOT_URL,
            cause: error
          })
      })
    }
  })

export class WindowService extends Effect.Service<WindowService>()('services/WindowService', {
  dependencies: [],
  effect: makeWindowService
}) {}
