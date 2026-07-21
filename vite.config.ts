import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        minesweeper: resolve(import.meta.dirname, 'src/games/minesweeper/register.ts'),
        '2048': resolve(import.meta.dirname, 'src/games/game2048/register.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}/iw-${entryName}.js`,
    },
    minify: 'esbuild',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
