import devServer from "@hono/vite-dev-server"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const __dirname = import.meta.dirname

export default defineConfig({
  plugins: [devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }), react()],
  server: { port: 3000 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    target: ["es2020", "safari14", "chrome90", "firefox90", "edge90"],
    emptyOutDir: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "mysql://sin:sin@localhost:3306/siniestros_test" },
  },
})
