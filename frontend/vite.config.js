import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.FRONTEND_PORT || 5173),
    proxy: {
      "/api/chat": {
        target: `http://localhost:${Number(process.env.CHATBOT_PORT || 8001)}`,
        changeOrigin: true
      },
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.js"
  }
});
