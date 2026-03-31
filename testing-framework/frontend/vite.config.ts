import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    /**
     * 默认 5173，避免与本机已占用的 3000 冲突。
     * 需要页面在 3000 时：先释放 3000，再执行 `npm run dev:3000 --prefix frontend`
     */
    port: Number(process.env.VITE_DEV_PORT) || 5173,
    strictPort: !!process.env.VITE_DEV_PORT,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
