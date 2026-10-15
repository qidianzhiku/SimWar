import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: ["chrome107", "edge107", "firefox104", "safari16"]
  },
  resolve: {
    alias: {
      "@simwar/shared-contracts": resolve(__dirname, "../../packages/shared-contracts/src/index.ts")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 3002
  }
});
