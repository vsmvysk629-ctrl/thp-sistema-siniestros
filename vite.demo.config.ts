// Demo navegable: la app completa (pantallas y servidor) corre dentro del navegador con datos ficticios.
// Uso: npm run demo:build → dist-demo/index.html (un solo archivo).
import fs from "fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const raiz = import.meta.dirname
const r = (p: string) => path.resolve(raiz, p)

/** Módulos del servidor que en la demo se reemplazan por su versión de navegador. */
const REEMPLAZOS: Record<string, string> = {
  [r("api/queries/connection.ts")]: r("demo/connection.ts"),
  [r("api/auth/password.ts")]: r("demo/password.ts"),
  [r("api/lib/env.ts")]: r("demo/env.ts"),
  [r("src/providers/trpc.tsx")]: r("demo/trpc.tsx"),
}

function demo(): Plugin {
  return {
    name: "thp-demo",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source === "dotenv/config") return "\0vacio"
      const res = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (res && REEMPLAZOS[res.id]) return REEMPLAZOS[res.id]
      return res
    },
    load(id) {
      if (id === "\0vacio") return "export {}"
    },
    transform(code, id) {
      if (!/\.(tsx|html)$/.test(id)) return
      // Logos y favicon dentro del mismo archivo.
      return code.replace(/(["'])(?:\.)?\/((?:logo-thp[\w-]*|favicon|segurito)\.png)\1/g, (_m, q, f) => `${q}data:image/png;base64,${fs.readFileSync(r(`public/${f}`)).toString("base64")}${q}`)
    },
    transformIndexHtml(html) {
      return html.replace(/href="\.\/favicon\.png"/, `href="data:image/png;base64,${fs.readFileSync(r("public/favicon.png")).toString("base64")}"`)
    },
  }
}

export default defineConfig({
  root: r("demo"),
  base: "./",
  publicDir: false,
  plugins: [demo(), react()],
  resolve: {
    alias: {
      "@": r("src"),
      "@contracts": r("contracts"),
      "@db": r("db"),
    },
  },
  build: {
    outDir: r("dist-demo"),
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
