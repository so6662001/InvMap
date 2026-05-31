import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 终端打包（Capacitor/Electron）以相对路径加载，故 base 用 './'
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 开发期把 /api 代理到本地后端
      '/api': { target: 'http://localhost:8080', changeOrigin: true }
    }
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 }
});
