import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        pet: resolve(__dirname, "pet.html"),
        settings: resolve(__dirname, "settings.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
