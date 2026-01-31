import { ElectronAPI } from '@electron-toolkit/preload'
import { IpcApi } from '@satori/shared/ipc/contract'

declare global {
  interface Window {
    electron: ElectronAPI
    api: IpcApi
  }
}
