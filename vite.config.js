import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5175,
    strictPort: false,
    watch: {
      usePolling: true,
      interval: 400,
    },
  },
})
