import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Wrangler keeps local room storage here; watching it would reload the page on every move.
    watch: { ignored: ['**/.wrangler/**', '**/dist/**'] },
    // `npm run dev` runs the room server with `wrangler dev` on 8787.
    proxy: {
      '/api': { target: 'http://localhost:8787', ws: true },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
