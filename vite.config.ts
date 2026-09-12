import { defineConfig, Plugin } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import * as csso from "csso";
import { minify as minifyHtml } from "html-minifier-terser";
import MagicString from "magic-string";

function scanExpression(code: string, start: number): number {
  let depth = 1;
  let i = start;
  let inQuote: string | null = null;
  let escaped = false;

  while (i < code.length && depth > 0) {
    const char = code[i];
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      i++;
      continue;
    }
    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      }
    } else {
      if (char === "'" || char === '"' || char === "`") {
        inQuote = char;
      } else if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
      }
    }
    i++;
  }
  return i;
}

function minifyCssContent(css: string): string {
  try {
    const minifier = (csso as any).minify || (csso as any).default?.minify;
    if (typeof minifier === "function") {
      return minifier(css, { restructure: false }).css;
    }
    throw new Error("csso.minify not found");
  } catch {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s*([{};:,>~+])\s*/g, "$1")
      .replace(/;}/g, "}")
      .replace(/\s+/g, " ")
      .trim();
  }
}

async function minifyHtmlContent(html: string): Promise<string> {
  try {
    return await minifyHtml(html, {
      collapseWhitespace: true,
      removeComments: true,
      collapseBooleanAttributes: true,
      removeEmptyAttributes: false,
      caseSensitive: true
    });
  } catch {
    return html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s+</g, "><")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
}

function minifyLiteralsPlugin(): Plugin {
  return {
    name: "vite-plugin-minify-literals",
    enforce: "pre",
    async transform(code: string, id: string) {
      if (!/\.(ts|js|mjs|cjs)$/.test(id) || id.includes("node_modules")) return null;
      if (
        !code.includes("/* css */") &&
        !code.includes("/* html */") &&
        !code.includes("css`") &&
        !code.includes("html`")
      ) {
        return null;
      }

      const MS = (MagicString as any).default || MagicString;
      const s = new MS(code);
      let changed = false;

      const markers = [
        { pattern: /\/\*\s*css\s*\*\/\s*`/g, type: "css" as const },
        { pattern: /\/\*\s*html\s*\*\/\s*`/g, type: "html" as const },
        { pattern: /\bcss\s*`/g, type: "css" as const },
        { pattern: /\bhtml\s*`/g, type: "html" as const }
      ];

      for (const { pattern, type } of markers) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(code)) !== null) {
          const backtickIndex = match.index + match[0].length - 1;

          let i = backtickIndex + 1;
          let bodyWithPlaceholders = "";
          const expressions: { placeholder: string; expr: string }[] = [];
          let placeholderCount = 0;
          let closed = false;

          while (i < code.length) {
            const char = code[i];
            if (char === "\\") {
              bodyWithPlaceholders += code.slice(i, i + 2);
              i += 2;
              continue;
            }
            if (char === "`") {
              closed = true;
              break;
            }
            if (char === "$" && code[i + 1] === "{") {
              const endExpr = scanExpression(code, i + 2);
              const rawExpr = code.slice(i, endExpr);
              const placeholder =
                type === "css"
                  ? `__V_CSS_${placeholderCount++}__`
                  : `__V_HTML_${placeholderCount++}__`;
              expressions.push({ placeholder, expr: rawExpr });
              bodyWithPlaceholders += placeholder;
              i = endExpr;
              continue;
            }
            bodyWithPlaceholders += char;
            i++;
          }

          if (closed) {
            const closingBacktickIndex = i;
            let minifiedBody =
              type === "css"
                ? minifyCssContent(bodyWithPlaceholders)
                : await minifyHtmlContent(bodyWithPlaceholders);

            for (const item of expressions) {
              minifiedBody = minifiedBody.replaceAll(item.placeholder, item.expr);
            }

            s.overwrite(backtickIndex + 1, closingBacktickIndex, minifiedBody);
            changed = true;
          }
        }
      }

      if (!changed) return null;
      return {
        code: s.toString(),
        map: s.generateMap({ hires: true })
      };
    }
  };
}

export default defineConfig(({ mode }) => {
  const isDemo = process.env.BUILD_TARGET === "demo";

  // ==========================================
  // 1. BUILD DEMO CONFIG (GITHUB PAGES)
  // ==========================================
  if (isDemo) {
    return {
      base: "/horeg-audio/",
      root: resolve(__dirname, "demo"),
      plugins: [
        // Minifikasi template literal CSS & HTML di dalam file source JS/TS
        minifyLiteralsPlugin(),
      ],
      build: {
        // Aktifkan minifikasi bundle JS (default Vite: 'esbuild')
        minify: "esbuild",
        outDir: resolve(__dirname, "dist-demo"),
        emptyOutDir: true,
      },
    };
  }

  // ==========================================
  // 2. BUILD PACKAGE CONFIG (NPM LIBRARY)
  // ==========================================
  return {
    plugins: [
      // Minifikasi template literal CSS & HTML di dalam file source JS/TS
      minifyLiteralsPlugin(),
      dts({ rollupTypes: true })
    ],
    build: {
      // Aktifkan minifikasi bundle JS (default Vite: 'esbuild')
      minify: "esbuild",
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
  };
});
