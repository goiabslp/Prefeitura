
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';
import { execSync } from 'child_process';

let latestCommit = 'Atualização geral de sistema.';
try {
  latestCommit = execSync('git log -1 --pretty=format:"%B"').toString().trim();
} catch (e) {
  console.warn('Could not fetch git commit:', e);
}

export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
    '__LATEST_COMMIT__': JSON.stringify(latestCommit),
  },
  plugins: [react()],
  server: {
    port: 3000,
    hmr: {
      overlay: false,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});
