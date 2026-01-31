import { app, BrowserWindow } from "electron"
import { electronApp, optimizer } from "@electron-toolkit/utils"
import { Effect, Layer, Exit, Cause, Option } from "effect"
import { APP_USER_MODEL_ID } from "./constants/window"
import { WindowService } from "./services/WindowService"
import { IpcService } from "./services/IpcService"

const MainLive = Layer.mergeAll(WindowService.Default, IpcService.Default)

const initializeApp = Effect.gen(function* () {
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const ipcService = yield* IpcService
  yield* ipcService.registerHandlers

  const windowService = yield* WindowService
  yield* windowService.createMainWindow

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      Effect.runPromise(
        windowService.createMainWindow.pipe(Effect.provide(MainLive))
      )
    }
  })
})

const program = initializeApp.pipe(Effect.provide(MainLive))

app.whenReady().then(() => {
  Effect.runPromiseExit(program).then((exit) => {
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      if (Option.isSome(failure)) {
        console.error("Application failed to initialize:", failure.value)
      } else {
        console.error("Application failed to initialize:", Cause.pretty(exit.cause))
      }
      app.quit()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
