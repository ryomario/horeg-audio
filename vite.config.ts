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
      name: "HoregAudio"
    },
    sourcemap: true,
    rollupOptions: {
      output: [
        {
          format: "es",
          entryFileNames: "horeg-audio.js",
          exports: "named"
        },
        {
          format: "cjs",
          entryFileNames: "horeg-audio.cjs",
          exports: "named",
          footer: "module.exports = Object.assign(exports.default || exports.HoregAudio, exports);"
        },
        {
          format: "iife",
          name: "HoregAudio",
          entryFileNames: "horeg-audio.global.js",
          exports: "named",
          footer: "\n;(function() {\n  if (typeof HoregAudio !== 'undefined') {\n    var ctor = HoregAudio.HoregAudio || HoregAudio.default || HoregAudio;\n    if (typeof ctor === 'function') {\n      for (var k in HoregAudio) {\n        if (Object.prototype.hasOwnProperty.call(HoregAudio, k)) {\n          try { ctor[k] = HoregAudio[k]; } catch (_) {}\n        }\n      }\n      if (typeof window !== 'undefined') window.HoregAudio = ctor;\n      if (typeof globalThis !== 'undefined') globalThis.HoregAudio = ctor;\n      if (typeof self !== 'undefined') self.HoregAudio = ctor;\n    }\n  }\n})();\n"
        }
      ]
    }
  }
});
