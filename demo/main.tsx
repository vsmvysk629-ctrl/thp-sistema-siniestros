import "./shim"
import { createRoot } from "react-dom/client"
import { HashRouter } from "react-router"
import "@/index.css"
import { iniciarDemo } from "./db"
import { Accesos } from "./Accesos"

const root = createRoot(document.getElementById("root")!)
iniciarDemo()
  .then(async () => {
    const [{ TRPCProvider }, { default: App }] = await Promise.all([import("@/providers/trpc"), import("@/App")])
    root.render(
      <HashRouter>
        <TRPCProvider>
          <App />
        </TRPCProvider>
        <Accesos />
      </HashRouter>,
    )
  })
  .catch((e) => {
    console.error(e)
    root.render(<p style={{ padding: 24, fontFamily: "sans-serif" }}>No se pudo iniciar la demo: {String(e?.message ?? e)}</p>)
  })
