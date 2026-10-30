import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build also works from a sub-folder (e.g. GitHub Pages).
  base: './',
  // three.js alone is ~600 kB, so one chunk of that size is expected.
  build: { chunkSizeWarningLimit: 800 },
});
