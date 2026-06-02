import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],


  server: {
    proxy: {
      // spring boot在本機端開的話 , 用http://localhost:8080
      '/api': { target: 'http://localhost:8080', changeOrigin: true }, 
      '/ws' : { target: 'http://localhost:8080', changeOrigin: true, ws: true },


      // spring boot在本機開(docker)的話 , 用http://127.0.0.1:9080
      // '/api': { target: 'http://127.0.0.1:9090', changeOrigin: true },
      // '/ws' : { target: 'http://127.0.0.1:9090', changeOrigin: true, ws: true },


      // 之前用模擬器的資料 , 用http://61.216.140.11:9002
      // '/api': { target: 'http://61.216.140.11:9002', changeOrigin: true },
      // '/ws' : { target: 'http://61.216.140.11:9002', changeOrigin: true, ws: true },


      // spring boot在遠端主機開的話 , 用http://61.216.140.11:9080
      // '/api': { target: 'http://61.216.140.11:9080', changeOrigin: true },
      // '/ws' : { target: 'http://61.216.140.11:9080', changeOrigin: true, ws: true },




      // Telegram
      '/tg': {
        target: 'http://61.216.140.11:9081',
        changeOrigin: true,
        secure: false,
        // 把 /tg 前綴去掉 → /tg/api/... 轉為 /api/...
        rewrite: p => p.replace(/^\/tg/, ''),

        // 把 Origin 改成上游自己的（或直接移除）
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.origin) {
              proxyReq.setHeader('origin', 'http://61.216.140.11:9081');
            }
          });
        },
      },
    },
  },


  
})
