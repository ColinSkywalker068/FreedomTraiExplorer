import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), fileURLToPath(new URL('../shared', import.meta.url))] },
    proxy: {
      '/api/npcs': process.env.NPC_BACKEND_URL ?? 'http://127.0.0.1:8000',
    },
  },
})
