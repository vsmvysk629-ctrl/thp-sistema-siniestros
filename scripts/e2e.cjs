// Prueba de punta a punta en el navegador, sobre la demo (no necesita base de datos).
// Uso: npm run demo:build && npm run e2e   (requiere Playwright con Chromium instalado)
const http = require("http")
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const html = fs.readFileSync(path.resolve(__dirname, "../dist-demo/index.html"))
const server = http.createServer((_q, r) => r.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html))
const fallas = []
const revisar = (ok, que) => { console.log(`${ok ? "  ✓" : "  ✗"} ${que}`); if (!ok) fallas.push(que) }

server.listen(0, async () => {
  const U = `http://localhost:${server.address().port}/#`
  const b = await chromium.launch()
  const errores = []
  async function entrar(usuario) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } })
    const p = await ctx.newPage()
    p.on("pageerror", (e) => errores.push(String(e)))
    await p.goto(U)
    await p.waitForSelector("input[autocomplete=username]")
    await p.fill("input[autocomplete=username]", usuario)
    await p.fill("input[type=password]", "Demo2026demo")
    await p.click('button:has-text("Entrar")')
    await p.waitForSelector("text=Alertas y pendientes")
    return p
  }
  async function estatus(p, destino, campos = {}) {
    await p.click('button:has-text("Cambiar estatus")')
    await p.selectOption(".fixed select", { label: destino })
    for (const [label, v] of Object.entries(campos)) await p.locator(`.fixed label:has-text("${label}")`).locator("input, textarea").first().fill(v)
    await p.click('button:has-text("Guardar estatus")')
    await p.waitForTimeout(600)
    const err = (await p.locator(".fixed p.text-tone-red").allTextContents()).join(" ")
    if (err) { await p.keyboard.press("Escape"); await p.waitForTimeout(200) }
    return err
  }
  const estatusActual = (p) => p.locator("h1").locator("xpath=..").locator("span.rounded-full").first().textContent()

  try {
    const p = await entrar("laura")
    await p.goto(U + "/siniestros/1")
    await p.waitForSelector("text=Avance del trámite")
    revisar(!(await estatus(p, "Recopilación de documentos")), "Laura pasa su siniestro a recopilación")
    revisar(/Faltan/.test(await estatus(p, "Documentación completa")), "No deja marcar documentación completa con documentos pendientes")
    await p.click('button:has-text("Documentación")')
    await p.waitForTimeout(300)
    const pdf = { name: "Denuncia-ficticia.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 demo") }
    await p.locator("li input[type=file]").first().setInputFiles(pdf)
    await p.waitForSelector("text=Denuncia-ficticia.pdf")
    revisar((await p.locator("li select").first().inputValue()) === "recibido", "Sube el archivo de un documento y queda recibido")
    await p.locator("input[type=file]").last().setInputFiles({ ...pdf, name: "Formato-reclamacion.pdf" })
    await p.waitForSelector("text=Formato-reclamacion.pdf")
    revisar(true, "Sube un formato suelto al expediente")
    const sels = p.locator("li select")
    for (let i = 0, n = await sels.count(); i < n; i++) { await sels.nth(i).selectOption("validado"); await p.waitForTimeout(200) }
    revisar(!(await estatus(p, "Documentación completa")), "Con todo validado pasa a documentación completa")
    revisar(!(await estatus(p, "Ingresado a aseguradora", { "Número de siniestro": "QUA-DEMO-777" })), "Ingresa con número de la aseguradora")
    revisar(!(await estatus(p, "Autorizado", { "Folio del dictamen": "DICT-DEMO-777", "Monto autorizado": "18500" })), "Se autoriza con folio y monto")
    await p.click('button:has-text("Financiero")')
    await p.click('button:has-text("Registrar pago")')
    await p.fill('.fixed label:has-text("Monto") >> input', "20000")
    await p.fill('.fixed label:has-text("Referencia") >> input', "TRF-DEMO-777")
    await p.click('.fixed button:has-text("Registrar pago")')
    await p.waitForTimeout(500)
    revisar(/excede/.test((await p.locator(".fixed p.text-tone-red").allTextContents()).join(" ")), "No acepta un pago mayor a lo autorizado")
    await p.fill('.fixed label:has-text("Monto") >> input', "18500")
    await p.click('.fixed button:has-text("Registrar pago")')
    await p.waitForTimeout(700)
    revisar((await estatusActual(p)).includes("Pagado"), "Con el pago completo queda Pagado")

    await p.goto(U + "/siniestros/4")
    await p.waitForSelector("text=Avance del trámite")
    revisar((await p.locator('button:has-text("Cambiar estatus")').count()) === 0, "Laura no puede mover un siniestro de Óscar")

    const c = await entrar("consulta")
    revisar((await c.locator('button:has-text("Nuevo siniestro")').count()) === 0, "Consulta no puede crear siniestros")
    await c.goto(U + "/siniestros/6")
    await c.waitForSelector("text=Avance del trámite")
    revisar((await c.locator('button:has-text("Cambiar estatus")').count()) === 0, "Consulta no puede cambiar estatus")
  } catch (e) {
    fallas.push(String(e))
    console.error(e)
  }
  revisar(errores.length === 0, `Sin errores en la página${errores.length ? ": " + errores.join(" | ") : ""}`)
  await b.close()
  server.close()
  console.log(fallas.length ? `\n${fallas.length} prueba(s) fallaron` : "\nTodo bien")
  process.exit(fallas.length ? 1 : 0)
})
