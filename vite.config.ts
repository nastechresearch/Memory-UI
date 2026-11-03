import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => {
  const isPagesBuild = mode === "pages";
  const base = process.env.PAGES_BASE_PATH || "/";

  return {
    base: isPagesBuild ? base : "/",
    resolve: {
      tsconfigPaths: true,
      dedupe: ["react", "react-dom", "@tanstack/react-router"],
    },
    plugins: [
      tailwindcss(),
      ...tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        server: { entry: "server" },
        ...(isPagesBuild ? { spa: { enabled: true } } : {}),
      }),
      ...(command === "build"
        ? [
            nitro(
              isPagesBuild
                ? { preset: "static" }
                : {
                    defaultPreset: "cloudflare-module",
                    cloudflare: { nodeCompat: true, deployConfig: true },
                  },
            ),
          ]
        : []),
      react(),
    ],
  };
});
