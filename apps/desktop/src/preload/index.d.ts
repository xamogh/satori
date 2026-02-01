import { IpcApi } from '@satori/ipc-contract/ipc/contract'

export type AppVersions = Readonly<{
  electron: string
  chrome: string
  node: string
}>

declare global {
  interface Window {
    versions: AppVersions
    api: IpcApi
  }
}
