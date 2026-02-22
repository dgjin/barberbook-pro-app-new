import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 加载环境变量（从 .env 文件）
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    // 安全：只暴露必要的环境变量到客户端
    define: {
      // 注意：这里的变量会暴露在客户端代码中，不要包含敏感信息
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // 添加 VITE_ 前缀的环境变量可以被 import.meta.env 访问
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // 开发服务器配置
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      // 开发服务器安全头
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      // 代理配置：解决浏览器直接请求 Supabase 产生的网络连接/CORS 问题
      proxy: {
        '/api/xfyun-tts': {
          target: 'https://ggqyitnxjcbulitacogg.supabase.co/functions/v1/xfyun-tts',
          changeOrigin: true,
          secure: false, // 应对可能的网络证书校验问题
          rewrite: (path) => path.replace(/^\/api\/xfyun-tts/, ''),
          headers: {
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY || 'sb_publishable_HeSdC3qng_IfFMZjdiQHkA_DEqRdivF'}`,
            'apikey': env.SUPABASE_ANON_KEY || 'sb_publishable_HeSdC3qng_IfFMZjdiQHkA_DEqRdivF'
          }
        }
      }
    }
  };
});
