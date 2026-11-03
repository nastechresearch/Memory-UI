import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || "/",
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: { input: { index: "pages.html" } },
  },
});
