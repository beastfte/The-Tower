import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // Relative asset URLs so the build works from any sub-path (GitHub Pages /The-Tower/, itch.io, Capacitor).
  base: "./",
  publicDir: "public",
  build: {
    outDir: "dist",
  },
});
