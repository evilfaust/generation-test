import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const localPkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = rootPkg.version || localPkg.version || '0.0.0'
const buildId = process.env.EGE_BUILD_ID || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
const buildDate = new Date().toISOString()

// https://vitejs.dev/config/
// Dev-only: SPA fallback rewrites
// /student/* → student.html (отдельный SPA entry)
// /app/*     → index.html  (учительский SPA, BrowserRouter)
const spaRewritePlugin = {
  name: 'spa-rewrite',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && req.url.startsWith('/student/')) {
        req.url = '/student.html';
      } else if (req.url && req.url.startsWith('/app')) {
        req.url = '/index.html';
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), spaRewritePlugin],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  // Пре-бандлим CodeMirror на старте дев-сервера, иначе при ПЕРВОЙ ленивой
  // загрузке расширенного редактора Vite обнаруживает новую зависимость и делает
  // разовый full-reload страницы (теряя несохранённое состояние). В проде неактуально.
  optimizeDeps: {
    include: [
      '@uiw/react-codemirror',
      '@codemirror/lang-markdown',
      '@codemirror/lint',
      '@codemirror/view',
      '@codemirror/state',
    ],
  },
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        student: resolve(__dirname, 'student.html'),
        landing: resolve(__dirname, 'landing.html'),
        howItWorks: resolve(__dirname, 'how-it-works.html'),
      },
      output: {
        manualChunks: {
          'markdown': ['unified', 'remark-parse', 'remark-math', 'remark-rehype', 'rehype-katex', 'rehype-stringify'],
          'antd': ['antd', '@ant-design/icons'],
        },
      },
    },
  },
})
