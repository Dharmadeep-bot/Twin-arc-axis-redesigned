import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      tailwindcss(), // Ensure this is present
      react(),
    ],
    server: {
      host: true,
      port: 5173,
      // Fixed the typo in your code from 'ints' to 'its' just in case
      allowedHosts: [env.VITE_ALLOWED_HOST] 
    }
  }
})