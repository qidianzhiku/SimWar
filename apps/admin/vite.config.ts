import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@simwar/shared-contracts": resolve(__dirname, "../../packages/shared-contracts/src/index.ts")
    }
  },
  server: {
    port: 3003
  }
});
