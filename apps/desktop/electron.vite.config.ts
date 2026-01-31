import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const domainSrc = resolve('../../packages/domain/src')
const apiContractSrc = resolve('../../packages/api-contract/src')
const ipcContractSrc = resolve('../../packages/ipc-contract/src')

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@satori/domain': domainSrc,
        '@satori/api-contract': apiContractSrc,
        '@satori/ipc-contract': ipcContractSrc
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@satori/domain': domainSrc,
        '@satori/api-contract': apiContractSrc,
        '@satori/ipc-contract': ipcContractSrc
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@satori/domain': domainSrc,
        '@satori/api-contract': apiContractSrc,
        '@satori/ipc-contract': ipcContractSrc
      }
    },
    server: {
      fs: {
        allow: [resolve('.'), resolve('../../packages')]
      }
    },
    plugins: [react()]
  }
})
