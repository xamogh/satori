import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const sharedSrc = resolve('../../packages/shared/src')

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@satori/shared': sharedSrc
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@satori/shared': sharedSrc
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@satori/shared': sharedSrc
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
