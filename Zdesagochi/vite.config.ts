import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  resolve: {
    alias: {
      '@zdesagochi/personality-core': path.resolve(__dirname, 'packages/personality-core/src/index.ts'),
      '@zdesagochi/personality-pet-preset': path.resolve(__dirname, 'packages/personality-pet-preset/src/index.ts'),
    },
  },
})
