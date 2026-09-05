import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // jsdom for localStorage and Response, not for rendering: the tests here are about
    // the client and the formatters, which is where the logic worth testing lives.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
