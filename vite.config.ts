import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "HoregAudio",
      fileName: (format) => `horeg-audio.${format === "es" ? "js" : format === "cjs" ? "cjs" : "global.js"}`,
      formats: ["es", "cjs", "iife"]
    },
    sourcemap: true,
    rollupOptions: {
      output: {
        exports: "named"
      }
    }
  }
});
