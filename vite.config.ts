import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  plugins: [react()],
  base: '/',
  server: {
    port: 3001,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
