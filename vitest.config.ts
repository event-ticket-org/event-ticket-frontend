import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // jsdom for localStorage and Response, and - rarely - for rendering. Most of what is worth
    // testing here is the client and the formatters, and a rendering test of a component with
    // no decision in it only asserts its own markup.
    //
    // `.tsx` is included because one thing did earn it: the manager shell's way out. That was
    // wrong twice, both times because a screen forgot to pass the exits in, and the only
    // assertion that would have caught it is whether a person can click their way out of the
    // rendered header.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
