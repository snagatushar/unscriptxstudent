import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      // Code-splitting: separate vendor chunks for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['motion/react'],
            'vendor-excel': ['exceljs', 'file-saver'],
          },
        },
      },
      // Smaller output
      target: 'es2020',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,  // Remove console.log in production
          drop_debugger: true,
        },
      },
      // Inline small assets
      assetsInlineLimit: 4096,
      // Enable source maps for debugging (disable for max perf)
      sourcemap: false,
      // Chunk size warning
      chunkSizeWarningLimit: 600,
    },
  };
});
