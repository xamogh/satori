import { BrowserWindow, shell } from "electron"
import { join } from "path"
import { is } from "@electron-toolkit/utils"
import { Effect, Context, Layer, Option } from "effect"
import icon from "../../../resources/icon.png?asset"
import {
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
} from "../constants/window"
import { WindowCreationError, FileLoadError } from "../errors"

export class WindowService extends Context.Tag("WindowService")<
  WindowService,
  {
    readonly createMainWindow: Effect.Effect<
      BrowserWindow,
      WindowCreationError | FileLoadError
    >
    readonly getMainWindow: Effect.Effect<Option.Option<BrowserWindow>, never>
  }
>() {}

const makeWindowService = Effect.sync(() => {
  let mainWindow: BrowserWindow | null = null

  return {
    createMainWindow: Effect.gen(function* () {
      const window = new BrowserWindow({
        width: DEFAULT_WINDOW_WIDTH,
        height: DEFAULT_WINDOW_HEIGHT,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === "linux" ? { icon } : {}),
        webPreferences: {
          preload: join(__dirname, "../preload/index.js"),
          sandbox: false,
        },
      })

      window.on("ready-to-show", () => {
        window.show()
      })

      window.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: "deny" }
      })

      yield* loadWindowContent(window)

      mainWindow = window
      return window
    }),

    getMainWindow: Effect.sync(() => Option.fromNullable(mainWindow)),
  }
})

const loadWindowContent = (
  window: BrowserWindow
): Effect.Effect<void, FileLoadError> =>
  Effect.gen(function* () {
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      yield* Effect.tryPromise({
        try: () => window.loadURL(process.env["ELECTRON_RENDERER_URL"]!),
        catch: (error) =>
          new FileLoadError({
            message: "Failed to load development URL",
            path: process.env["ELECTRON_RENDERER_URL"]!,
            cause: error,
          }),
      })
    } else {
      const filePath = join(__dirname, "../renderer/index.html")
      yield* Effect.tryPromise({
        try: () => window.loadFile(filePath),
        catch: (error) =>
          new FileLoadError({
            message: "Failed to load production file",
            path: filePath,
            cause: error,
          }),
      })
    }
  })

export const WindowServiceLive = Layer.effect(WindowService, makeWindowService)
