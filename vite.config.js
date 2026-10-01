import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // The dev server serves any file under the project root unless it's denied here.
      // Setting this replaces Vite's defaults, so they're repeated first.
      // data/ holds the SQLite file with every user's login token.
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', 'data/**', '**/*.db', '**/*.db-*'],
    },
  },
})
