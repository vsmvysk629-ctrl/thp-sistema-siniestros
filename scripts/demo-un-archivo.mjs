// Junta el build de la demo en un solo index.html (JS y CSS en línea).
import fs from "fs"
import path from "path"

const dir = path.resolve(import.meta.dirname, "../dist-demo")
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8")
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+)"><\/script>/, (_m, f) => {
  const js = fs.readFileSync(path.join(dir, f), "utf8").replace(/<\/script/gi, "<\\/script")
  return `<script type="module">${js}</script>`
})
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+)">/, (_m, f) => `<style>${fs.readFileSync(path.join(dir, f), "utf8")}</style>`)
fs.rmSync(path.join(dir, "assets"), { recursive: true, force: true })
fs.writeFileSync(path.join(dir, "index.html"), html)
console.log(`dist-demo/index.html · ${(html.length / 1e6).toFixed(1)} MB`)

// Versión para publicar como página de Claude (sin <html>/<head>/<body>; el título va primero).
const tomar = (re) => [...html.matchAll(re)].map((m) => m[0]).join("\n")
const pagina = [
  "<title>THP Siniestros · Demo</title>",
  tomar(/<link (?:rel="preconnect"|href="https:\/\/fonts)[^>]*>/g),
  "<style>:root{color-scheme:light}</style>",
  tomar(/<style>[\s\S]*?<\/style>/g),
  '<div id="root"></div>',
  tomar(/<script type="module">[\s\S]*?<\/script>/g),
].join("\n")
fs.writeFileSync(path.join(dir, "pagina.html"), pagina)
