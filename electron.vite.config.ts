import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      lib: {
        entry: path.resolve(__dirname, 'src/main/index.ts'),
        formats: ['es']
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer'),
        '@shared': path.resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      lib: {
        entry: path.resolve(__dirname, 'src/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js'
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html')
        }
      }
    },
    server: {
      watch: {
        ignored: ['**/release/**', '**/node_modules/**', '**/dist/**', '**/dist-electron/**']
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer'),
        '@shared': path.resolve(__dirname, 'src/shared')
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
    },
    plugins: [react()]
  }
})
