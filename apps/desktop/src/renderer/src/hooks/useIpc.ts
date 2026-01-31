import { useCallback } from "react"
import { Effect } from "effect"
import { IpcClientService, IpcClientServiceLive } from "../services/IpcClientService"
import type { IpcRequest, IpcResponse } from "@satori/ipc-contract/ipc/contract"

export type UseIpcResult = {
  readonly ping: () => Promise<IpcResponse<"ping">>
  readonly echo: (payload: IpcRequest<"echo">) => Promise<IpcResponse<"echo">>
}

export const useIpc = (): UseIpcResult => {
  const ping = useCallback((): Promise<IpcResponse<"ping">> => {
    const program = Effect.gen(function* () {
      const ipcService = yield* IpcClientService
      return yield* ipcService.ping
    }).pipe(Effect.provide(IpcClientServiceLive))

    return Effect.runPromise(program)
  }, [])

  const echo = useCallback(
    (payload: IpcRequest<"echo">): Promise<IpcResponse<"echo">> => {
      const program = Effect.gen(function* () {
        const ipcService = yield* IpcClientService
        return yield* ipcService.echo(payload)
      }).pipe(Effect.provide(IpcClientServiceLive))

      return Effect.runPromise(program)
    },
    []
  )

  return { ping, echo }
}
