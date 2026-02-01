import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const domainSrc = resolve('../../packages/domain/src')
const apiContractSrc = resolve('../../packages/api-contract/src')
const ipcContractSrc = resolve('../../packages/ipc-contract/src')
const workspaceNodeModules = resolve('../../node_modules')

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'workers/localDbWorker': resolve('src/main/workers/localDbWorker.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@satori/domain': domainSrc,
        '@satori/api-contract': apiContractSrc,
        '@satori/ipc-contract': ipcContractSrc
      }
    }
  },
  preload: {
    build: {
      externalizeDeps: false,
      isolatedEntries: true,
      rollupOptions: {
        output: {
          banner: '(() => {',
          footer: '})();'
        }
      }
    },
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
        allow: [resolve('.'), resolve('../../packages'), workspaceNodeModules]
      }
    },
    plugins: [react()]
  }
})
