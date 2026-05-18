import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import nodePolyfills from "vite-plugin-node-stdlib-browser";

export default defineConfig({
  root: "./client",
  envDir: "..",
  build: {
    target: "esnext",
    minify: false,
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 10598,
    open: true,
  },
  resolve: {
    alias: {
      "npm:@sinclair/typebox@^0.34.41": "@sinclair/typebox",
      "npm:/@sinclair/typebox@^0.34.41/value": "@sinclair/typebox/value",
      "npm:@sinclair/typebox@^0.34.41/value": "@sinclair/typebox/value",
      "npm:@sinclair/typebox@^0.34.30": "@sinclair/typebox",
      "npm:/@sinclair/typebox@^0.34.30/value": "@sinclair/typebox/value",
      "npm:@sinclair/typebox@^0.34.30/value": "@sinclair/typebox/value",
      "npm:viem": "viem",
      "npm:viem/accounts": "viem/accounts",
    },
  },
  plugins: [react(), nodePolyfills()],
});
