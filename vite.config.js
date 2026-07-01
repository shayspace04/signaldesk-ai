import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/st/auth": {
        target: "https://api.lemma.work",
        changeOrigin: true,
      },
      "/pods": {
        target: "https://api.lemma.work",
        changeOrigin: true,
      },
      "/users": {
        target: "https://api.lemma.work",
        changeOrigin: true,
      },
      "/agent-runtime": {
        target: "https://api.lemma.work",
        changeOrigin: true,
      },
      "/organizations": {
        target: "https://api.lemma.work",
        changeOrigin: true,
      },
    },
  },
});
