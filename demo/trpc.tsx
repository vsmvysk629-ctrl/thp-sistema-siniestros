// Demo: el cliente de tRPC llama al router del servidor dentro del mismo navegador.
import { createTRPCReact } from "@trpc/react-query"
import { httpBatchLink } from "@trpc/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import superjson from "superjson"
import type { ReactNode } from "react"
import { appRouter, type AppRouter } from "../api/router"
import { authenticateRequest } from "../api/auth/request"
import { leerSesion, guardarSesion } from "./db"

export const trpc = createTRPCReact<AppRouter>()

async function servidor(input: RequestInfo | URL, init?: RequestInit) {
  const req = new Request(new URL(String(input), "http://localhost:3000/"), init)
  let respuesta: Headers | undefined
  const res = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async ({ resHeaders }) => {
      respuesta = resHeaders
      const h = new Headers()
      h.set("cookie", leerSesion())
      return { req, resHeaders, user: await authenticateRequest(h) }
    },
  })
  const cookie = respuesta?.get("set-cookie")
  if (cookie) guardarSesion(/Max-Age=0/i.test(cookie) ? "" : cookie.split(";")[0])
  return res
}

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, fetch: servidor })],
})

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
