import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // The dev server serves the project root, so keep the database (users' login tokens) out of reach.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', 'data/**', '**/*.db', '**/*.db-*'] },
  },
})
