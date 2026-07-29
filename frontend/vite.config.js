import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/app/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/negocios-publicos": "http://localhost:3000",
      "/perfil-negocio": "http://localhost:3000",
      "/agenda-publica": "http://localhost:3000",
      "/agendamentos": "http://localhost:3000",
      "/meus-agendamentos": "http://localhost:3000",
      "/eventos-produto": "http://localhost:3000"
    }
  },
  build: {
    outDir: "../agendamento-nails/react-app",
    emptyOutDir: true
  }
});
