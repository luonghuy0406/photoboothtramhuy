import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';
import fs from 'fs';

// Check if Electron binary actually exists and is requested
const electronAppPath = path.resolve(__dirname, '../../node_modules/electron/dist/Electron.app');
const isElectronAvailable = fs.existsSync(electronAppPath);
const isElectronRequested = process.env.USE_ELECTRON === 'true' || (process.env.MODE !== 'browser' && process.env.MODE !== 'chrome');
const shouldEnableElectron = isElectronRequested && isElectronAvailable;

export default defineConfig({
  plugins: [
    react(),
    ...(shouldEnableElectron
      ? [
          electron([
            {
              entry: 'src/main/index.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                },
              },
            },
            {
              entry: 'src/main/preload.ts',
              onstart(options) {
                options.reload();
              },
              vite: {
                build: {
                  outDir: 'dist-electron',
                },
              },
            },
          ]),
        ]
      : []),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
