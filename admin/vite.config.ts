import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/web/" : "/",
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["piscivorous-annamae-spectroscopical.ngrok-free.dev"],
  },
}));

