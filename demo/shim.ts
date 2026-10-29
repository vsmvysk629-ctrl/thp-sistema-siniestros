// Lo mínimo de Node que usan los módulos del servidor al cargarse.
const g = globalThis as Record<string, unknown>
g.process ??= { env: { NODE_ENV: "demo" }, exit: () => {} }
g.Buffer ??= { alloc: (n: number) => ({ toString: () => btoa(String.fromCharCode(...new Uint8Array(n))) }) }
